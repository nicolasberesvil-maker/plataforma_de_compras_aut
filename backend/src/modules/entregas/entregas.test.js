import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';

const run = crypto.randomUUID().slice(0, 8);
const emailsCreados = [];
const depositoIds = [];
let productoId;
let adminToken;
let cuitSeq = 0;

async function crearUsuario(email, rol) {
  emailsCreados.push(email);
  const passwordHash = await bcrypt.hash('clave12345', 4);
  return prisma.usuario.create({
    data: { email, username: email.split('@')[0], passwordHash, rol, activo: true, nombre: 'Test', apellido: 'User' }
  });
}

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ username: email.split('@')[0], password: 'clave12345' });
  return res.body.accessToken;
}

function siguienteCuit() {
  cuitSeq += 1;
  return `30${run.replace(/\D/g, '').padEnd(7, '1').slice(0, 7)}${String(cuitSeq).padStart(2, '0')}`;
}

async function crearProveedor(sufijo) {
  const email = `proveedor-ent-${sufijo}-${run}@test.com`;
  const usuario = await crearUsuario(email, 'PROVEEDOR');
  return prisma.proveedor.create({
    data: {
      usuarioId: usuario.id,
      razonSocial: `Insumos ${sufijo}`,
      cuit: siguienteCuit(),
      condicionFiscal: 'RESPONSABLE_INSCRIPTO',
      domicilioFiscal: 'Ruta 9',
      estadoAprobacion: 'APROBADO'
    }
  });
}

// El login real pasa por un rate limiter (10/15min) compartido por archivo
// de test; con varios productores por test lo excede rápido. Como acá solo
// nos interesa el token para pegarle a /api/entregas (no probar login en
// sí), firmamos el JWT directo con el mismo payload que generarAccessToken.
function tokenPara(usuario) {
  return jwt.sign({ usuarioId: usuario.id, rol: usuario.rol, email: usuario.email }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

async function crearProductor(sufijo) {
  const email = `productor-ent-${sufijo}-${run}@test.com`;
  const usuario = await crearUsuario(email, 'PRODUCTOR');
  const productor = await prisma.productor.create({
    data: {
      usuarioId: usuario.id,
      razonSocial: `Campo ${sufijo}`,
      cuit: siguienteCuit(),
      condicionFiscal: 'MONOTRIBUTISTA',
      domicilioFiscal: 'Ruta 1',
      localidad: 'Franck'
    }
  });
  const token = tokenPara(usuario);
  return { productor, token };
}

async function crearDeposito(nombre) {
  const deposito = await prisma.deposito.create({ data: { nombre, localidad: 'Franck', direccion: 'Ruta 1' } });
  depositoIds.push(deposito.id);
  return deposito;
}

/**
 * Arma una campaña colectiva completa hasta ADJUDICADA para obtener una
 * Entrega en estado PENDIENTE lista para ejercitar sus transiciones.
 */
async function crearEntregaAdjudicada(sufijo, { volumen = 100, modalidadEntregaPreferida } = {}) {
  const crear = await request(app)
    .post('/api/campanas')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      productoId,
      tipo: 'COLECTIVA',
      nombre: `Campana Entregas ${sufijo} ${run}`,
      volumenMinimo: 1,
      fechaApertura: new Date().toISOString(),
      fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
    });
  const campanaId = crear.body.campana.id;

  await request(app).post(`/api/campanas/${campanaId}/abrir`).set('Authorization', `Bearer ${adminToken}`);

  const { productor, token: productorToken } = await crearProductor(sufijo);
  await prisma.intencionCompra.create({
    data: { campanaId, productorId: productor.id, productoId, volumen, modalidadEntregaPreferida }
  });

  await request(app).post(`/api/campanas/${campanaId}/cerrar-intenciones`).set('Authorization', `Bearer ${adminToken}`).send({});

  const proveedor = await crearProveedor(sufijo);
  const cotizacion = await prisma.cotizacion.create({
    data: {
      campanaId,
      proveedorId: proveedor.id,
      precioUnitario: 150,
      monedaPrecio: 'ARS',
      plazoEntregaDias: 10,
      condicionesPago: '30 días',
      validaHasta: new Date(Date.now() + 30 * 86400000)
    }
  });

  const adj = await request(app)
    .post('/api/adjudicaciones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ campanaId, cotizacionGanadoraId: cotizacion.id });

  const orden = await prisma.ordenCompra.findFirstOrThrow({ where: { adjudicacionId: adj.body.adjudicacion.id } });
  const entrega = await prisma.entrega.findUniqueOrThrow({ where: { ordenCompraId: orden.id } });

  return { campanaId, entrega, productor, productorToken };
}

beforeAll(async () => {
  const email = `admin-entregas-${run}@test.com`;
  await crearUsuario(email, 'ADMIN');
  adminToken = await login(email);

  const producto = await prisma.producto.create({
    data: { nombre: `Producto Entregas ${run}`, categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 }
  });
  productoId = producto.id;
});

afterAll(async () => {
  const campanas = await prisma.campana.findMany({ where: { productoId }, select: { id: true } });
  const campanaIds = campanas.map((c) => c.id);

  await prisma.stockMovimiento.deleteMany({ where: { entrega: { ordenCompra: { adjudicacion: { campanaId: { in: campanaIds } } } } } });
  await prisma.entrega.deleteMany({ where: { ordenCompra: { adjudicacion: { campanaId: { in: campanaIds } } } } });
  await prisma.ordenCompra.deleteMany({ where: { adjudicacion: { campanaId: { in: campanaIds } } } });
  await prisma.adjudicacion.deleteMany({ where: { campanaId: { in: campanaIds } } });
  await prisma.cotizacion.deleteMany({ where: { campanaId: { in: campanaIds } } });
  await prisma.intencionCompra.deleteMany({ where: { productoId } });
  await prisma.campana.deleteMany({ where: { productoId } });
  await prisma.deposito.deleteMany({ where: { id: { in: depositoIds } } });
  await prisma.producto.delete({ where: { id: productoId } });
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.proveedor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.productor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('PATCH /api/entregas/:id/disponible', () => {
  it('marcar DISPONIBLE en entrega tipo CAMPO → 400', async () => {
    const { entrega } = await crearEntregaAdjudicada('disp-campo', { modalidadEntregaPreferida: 'ENTREGA_EN_CAMPO' });

    const res = await request(app)
      .patch(`/api/entregas/${entrega.id}/disponible`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('marcar DISPONIBLE en entrega tipo RETIRO sin depósito → 400', async () => {
    const { entrega } = await crearEntregaAdjudicada('disp-sin-deposito', { modalidadEntregaPreferida: 'RETIRO_EN_DEPOSITO' });

    const res = await request(app)
      .patch(`/api/entregas/${entrega.id}/disponible`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('marcar DISPONIBLE en entrega tipo RETIRO con depósito → 200', async () => {
    const { entrega } = await crearEntregaAdjudicada('disp-ok', { modalidadEntregaPreferida: 'RETIRO_EN_DEPOSITO' });
    const deposito = await crearDeposito(`Depósito Disponible ${run}`);

    const res = await request(app)
      .patch(`/api/entregas/${entrega.id}/disponible`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoId: deposito.id });

    expect(res.status).toBe(200);
    expect(res.body.entrega.estado).toBe('DISPONIBLE_PARA_RETIRO');
    expect(res.body.entrega.depositoId).toBe(deposito.id);
  });
});

describe('PATCH /api/entregas/:id/confirmar-retiro', () => {
  it('genera movimiento de stock EGRESO_PRODUCTOR con cantidad correcta', async () => {
    const { entrega } = await crearEntregaAdjudicada('retiro-ok', { volumen: 30, modalidadEntregaPreferida: 'RETIRO_EN_DEPOSITO' });
    const deposito = await crearDeposito(`Depósito Retiro ${run}`);

    await request(app)
      .patch(`/api/entregas/${entrega.id}/disponible`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoId: deposito.id });

    const res = await request(app)
      .patch(`/api/entregas/${entrega.id}/confirmar-retiro`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ recibidaPorNombre: 'Juan Pérez', recibidaPorDni: '12345678', observaciones: 'Retiró todo' });

    expect(res.status).toBe(200);
    expect(res.body.entrega.estado).toBe('ENTREGADA');

    const movimientos = await prisma.stockMovimiento.findMany({ where: { entregaId: entrega.id } });
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0].tipo).toBe('EGRESO_PRODUCTOR');
    expect(Number(movimientos[0].cantidad)).toBe(30);
    expect(movimientos[0].signo).toBe(-1);
  });

  it('confirmar retiro en entrega ya ENTREGADA → 409', async () => {
    const { entrega } = await crearEntregaAdjudicada('retiro-doble', { modalidadEntregaPreferida: 'RETIRO_EN_DEPOSITO' });
    const deposito = await crearDeposito(`Depósito Doble ${run}`);

    await request(app)
      .patch(`/api/entregas/${entrega.id}/disponible`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoId: deposito.id });

    await request(app)
      .patch(`/api/entregas/${entrega.id}/confirmar-retiro`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ recibidaPorNombre: 'Juan Pérez', recibidaPorDni: '12345678' });

    const res = await request(app)
      .patch(`/api/entregas/${entrega.id}/confirmar-retiro`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ recibidaPorNombre: 'Juan Pérez', recibidaPorDni: '12345678' });

    expect(res.status).toBe(409);
  });

  it('no se puede confirmar retiro salteando DISPONIBLE_PARA_RETIRO (desde EN_TRANSITO) → 409', async () => {
    const { entrega } = await crearEntregaAdjudicada('retiro-sin-disponible', { modalidadEntregaPreferida: 'RETIRO_EN_DEPOSITO' });
    const deposito = await crearDeposito(`Depósito Salteo ${run}`);

    await request(app)
      .patch(`/api/entregas/${entrega.id}/en-transito`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoId: deposito.id });

    const res = await request(app)
      .patch(`/api/entregas/${entrega.id}/confirmar-retiro`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ recibidaPorNombre: 'Juan Pérez', recibidaPorDni: '12345678' });

    expect(res.status).toBe(409);
    const sinMovimiento = await prisma.stockMovimiento.findMany({ where: { entregaId: entrega.id } });
    expect(sinMovimiento).toHaveLength(0);
  });
});

describe('GET /api/entregas/:id', () => {
  it('un rol ajeno (PROVEEDOR) no puede ver el detalle de una entrega de otro → 403', async () => {
    const { entrega } = await crearEntregaAdjudicada('detalle-ajeno', { modalidadEntregaPreferida: 'RETIRO_EN_DEPOSITO' });
    const proveedorIntruso = await crearProveedor('detalle-intruso');
    const usuarioProveedor = await prisma.usuario.findUnique({ where: { id: proveedorIntruso.usuarioId } });
    const tokenProveedor = tokenPara(usuarioProveedor);

    const res = await request(app)
      .get(`/api/entregas/${entrega.id}`)
      .set('Authorization', `Bearer ${tokenProveedor}`);

    expect(res.status).toBe(403);
  });

  it('ADMIN puede ver el detalle de cualquier entrega', async () => {
    const { entrega } = await crearEntregaAdjudicada('detalle-admin', { modalidadEntregaPreferida: 'RETIRO_EN_DEPOSITO' });

    const res = await request(app)
      .get(`/api/entregas/${entrega.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.entrega.id).toBe(entrega.id);
  });
});

describe('PATCH /api/entregas/:id/confirmar-entrega-campo', () => {
  it('el productor dueño confirma su propia entrega ENTREGA_EN_CAMPO → 200', async () => {
    const { entrega, productorToken } = await crearEntregaAdjudicada('campo-owner', { modalidadEntregaPreferida: 'ENTREGA_EN_CAMPO' });

    await request(app)
      .patch(`/api/entregas/${entrega.id}/en-transito`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const res = await request(app)
      .patch(`/api/entregas/${entrega.id}/confirmar-entrega-campo`)
      .set('Authorization', `Bearer ${productorToken}`)
      .send({ recibidaPorNombre: 'El propio productor', recibidaPorDni: '30111222' });

    expect(res.status).toBe(200);
    expect(res.body.entrega.estado).toBe('ENTREGADA');
  });

  it('un productor intenta confirmar la entrega de OTRO productor → 403', async () => {
    const { entrega } = await crearEntregaAdjudicada('campo-ajena', { modalidadEntregaPreferida: 'ENTREGA_EN_CAMPO' });
    const { token: otroToken } = await crearProductor('campo-intruso');

    await request(app)
      .patch(`/api/entregas/${entrega.id}/en-transito`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const res = await request(app)
      .patch(`/api/entregas/${entrega.id}/confirmar-entrega-campo`)
      .set('Authorization', `Bearer ${otroToken}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('ADMIN también puede confirmar entrega en campo', async () => {
    const { entrega } = await crearEntregaAdjudicada('campo-admin', { modalidadEntregaPreferida: 'ENTREGA_EN_CAMPO' });

    await request(app)
      .patch(`/api/entregas/${entrega.id}/en-transito`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const res = await request(app)
      .patch(`/api/entregas/${entrega.id}/confirmar-entrega-campo`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ recibidaPorNombre: 'Encargado AUT', recibidaPorDni: '30111333' });

    expect(res.status).toBe(200);
  });
});

describe('GET /api/entregas/mias', () => {
  it('el productor ve sus propias entregas', async () => {
    const { productorToken } = await crearEntregaAdjudicada('mias', { modalidadEntregaPreferida: 'RETIRO_EN_DEPOSITO' });

    const res = await request(app)
      .get('/api/entregas/mias')
      .set('Authorization', `Bearer ${productorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.entregas.length).toBeGreaterThan(0);
  });
});
