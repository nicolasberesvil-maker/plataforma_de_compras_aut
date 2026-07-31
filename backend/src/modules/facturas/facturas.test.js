import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';

const run = crypto.randomUUID().slice(0, 8);
const emailsCreados = [];
let productoId;
let adminToken;
let cuitSeq = 0;

async function crearUsuario(email, rol) {
  emailsCreados.push(email);
  const passwordHash = await bcrypt.hash('clave12345', 4);
  return prisma.usuario.create({
    data: { email, passwordHash, rol, activo: true, nombre: 'Test', apellido: 'User' }
  });
}

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'clave12345' });
  return res.body.accessToken;
}

function siguienteCuit() {
  cuitSeq += 1;
  return `20${run.replace(/\D/g, '').padEnd(7, '1').slice(0, 7)}${String(cuitSeq).padStart(2, '0')}`;
}

// El login real pasa por un rate limiter (10/15min) compartido por archivo
// de test; con varios productores por test lo excede rápido. Firmamos el
// JWT directo con el mismo payload que generarAccessToken (ver entregas.test.js).
function tokenPara(usuario) {
  return jwt.sign({ usuarioId: usuario.id, rol: usuario.rol, email: usuario.email }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

async function crearProductor(sufijo, { condicionFiscal = 'MONOTRIBUTISTA', domicilioFiscal = 'Ruta 1' } = {}) {
  const email = `productor-fac-${sufijo}-${run}@test.com`;
  const usuario = await crearUsuario(email, 'PRODUCTOR');
  const productor = await prisma.productor.create({
    data: {
      usuarioId: usuario.id,
      razonSocial: `Campo ${sufijo}`,
      cuit: siguienteCuit(),
      condicionFiscal,
      domicilioFiscal,
      localidad: 'Franck',
      aprobado: true
    }
  });
  const token = tokenPara(usuario);
  return { usuario, productor, token };
}

async function crearProveedor(sufijo) {
  const email = `proveedor-fac-${sufijo}-${run}@test.com`;
  const usuario = await crearUsuario(email, 'PROVEEDOR');
  return prisma.proveedor.create({
    data: {
      usuarioId: usuario.id,
      razonSocial: `Insumos ${sufijo}`,
      cuit: `30${siguienteCuit().slice(2)}`,
      condicionFiscal: 'RESPONSABLE_INSCRIPTO',
      domicilioFiscal: 'Ruta 9',
      estadoAprobacion: 'APROBADO'
    }
  });
}

/** Arma una OrdenCompra real pasando por el flujo de adjudicación completo. */
async function crearOrdenParaProductor(sufijo, productor, { volumen = 100, precioUnitario = 150 } = {}) {
  const crear = await request(app)
    .post('/api/campanas')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      productoId, tipo: 'COLECTIVA', nombre: `Campana Facturas ${sufijo} ${run}`, volumenMinimo: 1,
      fechaApertura: new Date().toISOString(), fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
    });
  const campanaId = crear.body.campana.id;
  await request(app).post(`/api/campanas/${campanaId}/abrir`).set('Authorization', `Bearer ${adminToken}`);
  await prisma.intencionCompra.create({ data: { campanaId, productorId: productor.id, productoId, volumen } });
  await request(app).post(`/api/campanas/${campanaId}/cerrar-intenciones`).set('Authorization', `Bearer ${adminToken}`).send({});

  const proveedor = await crearProveedor(sufijo);
  const cotizacion = await prisma.cotizacion.create({
    data: {
      campanaId, proveedorId: proveedor.id, precioUnitario, monedaPrecio: 'ARS', plazoEntregaDias: 5,
      condicionesPago: 'Contado', validaHasta: new Date(Date.now() + 86400000)
    }
  });
  const adj = await request(app)
    .post('/api/adjudicaciones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ campanaId, cotizacionGanadoraId: cotizacion.id });

  const [orden] = await prisma.ordenCompra.findMany({ where: { adjudicacionId: adj.body.adjudicacion.id } });
  return orden;
}

beforeAll(async () => {
  const email = `admin-facturas-${run}@test.com`;
  await crearUsuario(email, 'ADMIN');
  adminToken = await login(email);

  const producto = await prisma.producto.create({
    data: { nombre: `Producto Facturas ${run}`, categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 }
  });
  productoId = producto.id;
});

afterAll(async () => {
  const campanas = await prisma.campana.findMany({ where: { productoId }, select: { id: true } });
  const campanaIds = campanas.map((c) => c.id);

  await prisma.itemFactura.deleteMany({ where: { factura: { ordenCompra: { adjudicacion: { campanaId: { in: campanaIds } } } } } });
  await prisma.factura.deleteMany({ where: { ordenCompra: { adjudicacion: { campanaId: { in: campanaIds } } } } });
  await prisma.entrega.deleteMany({ where: { ordenCompra: { adjudicacion: { campanaId: { in: campanaIds } } } } });
  await prisma.ordenCompra.deleteMany({ where: { adjudicacion: { campanaId: { in: campanaIds } } } });
  await prisma.adjudicacion.deleteMany({ where: { campanaId: { in: campanaIds } } });
  await prisma.cotizacion.deleteMany({ where: { campanaId: { in: campanaIds } } });
  await prisma.intencionCompra.deleteMany({ where: { productoId } });
  await prisma.campana.deleteMany({ where: { productoId } });
  await prisma.producto.delete({ where: { id: productoId } });
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.proveedor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.productor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('POST /api/facturas/generar/:ordenCompraId', () => {
  it('genera factura tipo A para productor Responsable Inscripto en Santa Fe, con percepción IIBB', async () => {
    const { productor } = await crearProductor('ri-sf', { condicionFiscal: 'RESPONSABLE_INSCRIPTO', domicilioFiscal: 'Ruta 1, Santa Fe' });
    const orden = await crearOrdenParaProductor('ri-sf', productor);

    const res = await request(app)
      .post(`/api/facturas/generar/${orden.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.factura.tipo).toBe('A');
    expect(res.body.factura.numero).toMatch(/^A-\d{8}$/);
    expect(Number(res.body.factura.percepcionesIIBB)).toBeGreaterThan(0);
    expect(res.body.factura.pdfUrl).toBeTruthy();
  });

  it('genera factura tipo B para productor Monotributista, sin percepción IIBB', async () => {
    const { productor } = await crearProductor('mono', { condicionFiscal: 'MONOTRIBUTISTA' });
    const orden = await crearOrdenParaProductor('mono', productor);

    const res = await request(app)
      .post(`/api/facturas/generar/${orden.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.factura.tipo).toBe('B');
    expect(res.body.factura.numero).toMatch(/^B-\d{8}$/);
    expect(res.body.factura.percepcionesIIBB).toBeNull();
  });

  it('numeración correlativa por tipo: la segunda factura B sigue a la primera', async () => {
    const { productor: p1 } = await crearProductor('corr-1');
    const orden1 = await crearOrdenParaProductor('corr-1', p1);
    const r1 = await request(app).post(`/api/facturas/generar/${orden1.id}`).set('Authorization', `Bearer ${adminToken}`);

    const { productor: p2 } = await crearProductor('corr-2');
    const orden2 = await crearOrdenParaProductor('corr-2', p2);
    const r2 = await request(app).post(`/api/facturas/generar/${orden2.id}`).set('Authorization', `Bearer ${adminToken}`);

    const n1 = parseInt(r1.body.factura.numero.split('-')[1], 10);
    const n2 = parseInt(r2.body.factura.numero.split('-')[1], 10);
    expect(n2).toBe(n1 + 1);
  });

  it('generar dos veces para la misma orden → 409', async () => {
    const { productor } = await crearProductor('doble');
    const orden = await crearOrdenParaProductor('doble', productor);

    await request(app).post(`/api/facturas/generar/${orden.id}`).set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app).post(`/api/facturas/generar/${orden.id}`).set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
  });

  it('un PRODUCTOR no puede generar facturas → 403', async () => {
    const { productor, token } = await crearProductor('sin-permiso');
    const orden = await crearOrdenParaProductor('sin-permiso', productor);

    const res = await request(app)
      .post(`/api/facturas/generar/${orden.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/facturas/mias', () => {
  it('el productor ve solo sus propias facturas', async () => {
    const { productor, token } = await crearProductor('mias');
    const orden = await crearOrdenParaProductor('mias', productor);
    await request(app).post(`/api/facturas/generar/${orden.id}`).set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app).get('/api/facturas/mias').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.facturas).toHaveLength(1);
    expect(res.body.facturas[0].ordenCompra.productorId).toBe(productor.id);
  });
});

describe('GET /api/facturas/:id — ownership y descarga', () => {
  it('un productor ajeno no puede ver la factura de otro → 403', async () => {
    const { productor: dueno } = await crearProductor('detalle-dueno');
    const orden = await crearOrdenParaProductor('detalle-dueno', dueno);
    const generada = await request(app).post(`/api/facturas/generar/${orden.id}`).set('Authorization', `Bearer ${adminToken}`);

    const { token: tokenOtro } = await crearProductor('detalle-otro');
    const res = await request(app)
      .get(`/api/facturas/${generada.body.factura.id}`)
      .set('Authorization', `Bearer ${tokenOtro}`);

    expect(res.status).toBe(403);
  });

  it('el dueño puede descargar el PDF de su factura', async () => {
    const { productor, token } = await crearProductor('descarga');
    const orden = await crearOrdenParaProductor('descarga', productor);
    const generada = await request(app).post(`/api/facturas/generar/${orden.id}`).set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get(`/api/facturas/${generada.body.factura.id}/pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });
});
