import bcrypt from 'bcrypt';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';

const run = crypto.randomUUID().slice(0, 8);
const emailsCreados = [];
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
  return `20${run.replace(/\D/g, '').padEnd(7, '1').slice(0, 7)}${String(cuitSeq).padStart(2, '0')}`;
}

async function crearProductor(sufijo, { conLogin = false } = {}) {
  const email = `productor-ord-${sufijo}-${run}@test.com`;
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
  const token = conLogin ? await login(email) : null;
  return { usuario, productor, token };
}

async function crearProveedor(sufijo) {
  const email = `proveedor-ord-${sufijo}-${run}@test.com`;
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
      productoId, tipo: 'COLECTIVA', nombre: `Campana Ordenes ${sufijo} ${run}`, volumenMinimo: 1,
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
  const email = `admin-ordenes-${run}@test.com`;
  await crearUsuario(email, 'ADMIN');
  adminToken = await login(email);

  const producto = await prisma.producto.create({
    data: { nombre: `Producto Ordenes ${run}`, categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 }
  });
  productoId = producto.id;
});

afterAll(async () => {
  const campanas = await prisma.campana.findMany({ where: { productoId }, select: { id: true } });
  const campanaIds = campanas.map((c) => c.id);

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

describe('GET /api/ordenes/mias', () => {
  it('el productor ve sus órdenes generadas por la adjudicación', async () => {
    const { productor, token } = await crearProductor('mias', { conLogin: true });
    await crearOrdenParaProductor('mias', productor);

    const res = await request(app).get('/api/ordenes/mias').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ordenes).toHaveLength(1);
    expect(res.body.ordenes[0].adjudicacion.campana.producto.id).toBe(productoId);
  });
});

describe('GET /api/ordenes/:id — ownership', () => {
  it('un productor no puede ver la orden de otro productor (403)', async () => {
    const { productor: dueno } = await crearProductor('dueno');
    const orden = await crearOrdenParaProductor('dueno', dueno);
    const { token: tokenOtro } = await crearProductor('otro', { conLogin: true });

    const res = await request(app).get(`/api/ordenes/${orden.id}`).set('Authorization', `Bearer ${tokenOtro}`);
    expect(res.status).toBe(403);
  });

  it('ADMIN puede ver cualquier orden', async () => {
    const { productor } = await crearProductor('admin-ve');
    const orden = await crearOrdenParaProductor('admin-ve', productor);

    const res = await request(app).get(`/api/ordenes/${orden.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orden.id).toBe(orden.id);
  });
});

describe('POST /api/ordenes/:id/marcar-pagada', () => {
  it('ADMIN marca una orden como PAGADO', async () => {
    const { productor } = await crearProductor('marcar-pagada');
    const orden = await crearOrdenParaProductor('marcar-pagada', productor);

    const res = await request(app)
      .post(`/api/ordenes/${orden.id}/marcar-pagada`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.orden.estadoPago).toBe('PAGADO');
  });
});
