import bcrypt from 'bcrypt';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';
import { procesarAdjudicacionDirecta } from './adjudicaciones.service.js';

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
  return `30${run.replace(/\D/g, '').padEnd(7, '1').slice(0, 7)}${String(cuitSeq).padStart(2, '0')}`;
}

// Se crean Proveedor/Productor directo por Prisma (sin login): estos tests
// solo pegan contra endpoints de ADMIN, y evitar logins de más importa acá
// porque /api/auth/login tiene rate limit (10/15min) compartido por archivo.
async function crearProveedor(sufijo) {
  const email = `proveedor-adj-${sufijo}-${run}@test.com`;
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

async function crearProductor(sufijo) {
  const email = `productor-adj-${sufijo}-${run}@test.com`;
  const usuario = await crearUsuario(email, 'PRODUCTOR');
  return prisma.productor.create({
    data: {
      usuarioId: usuario.id,
      razonSocial: `Campo ${sufijo}`,
      cuit: siguienteCuit(),
      condicionFiscal: 'MONOTRIBUTISTA',
      domicilioFiscal: 'Ruta 1',
      localidad: 'Franck',
      aprobado: true
    }
  });
}

async function crearCampanaConIntencion(sufijo, { volumen = 100 } = {}) {
  const crear = await request(app)
    .post('/api/campanas')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      productoId,
      tipo: 'COLECTIVA',
      nombre: `Campana Adjudicacion ${sufijo} ${run}`,
      volumenMinimo: 1,
      fechaApertura: new Date().toISOString(),
      fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
    });
  const campanaId = crear.body.campana.id;

  await request(app).post(`/api/campanas/${campanaId}/abrir`).set('Authorization', `Bearer ${adminToken}`);

  const productor = await crearProductor(sufijo);
  await prisma.intencionCompra.create({
    data: { campanaId, productorId: productor.id, productoId, volumen }
  });

  await request(app).post(`/api/campanas/${campanaId}/cerrar-intenciones`).set('Authorization', `Bearer ${adminToken}`).send({});

  return { campanaId, productor };
}

async function crearCotizacion(campanaId, proveedorId, overrides = {}) {
  return prisma.cotizacion.create({
    data: {
      campanaId,
      proveedorId,
      precioUnitario: 1500,
      monedaPrecio: 'ARS',
      plazoEntregaDias: 10,
      condicionesPago: '30 días contra factura',
      validaHasta: new Date(Date.now() + 30 * 86400000),
      ...overrides
    }
  });
}

beforeAll(async () => {
  const email = `admin-adjudicaciones-${run}@test.com`;
  await crearUsuario(email, 'ADMIN');
  adminToken = await login(email);

  const producto = await prisma.producto.create({
    data: { nombre: `Producto Adjudicaciones ${run}`, categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 }
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

describe('GET /api/adjudicaciones/comparador/:campanaId', () => {
  it('lista cotizaciones ordenadas por precio con volumen consolidado', async () => {
    const { campanaId } = await crearCampanaConIntencion('comparador', { volumen: 200 });
    const proveedorCaro = await crearProveedor('comparador-caro');
    const proveedorBarato = await crearProveedor('comparador-barato');
    await crearCotizacion(campanaId, proveedorCaro.id, { precioUnitario: 2000 });
    await crearCotizacion(campanaId, proveedorBarato.id, { precioUnitario: 1000 });

    const res = await request(app)
      .get(`/api/adjudicaciones/comparador/${campanaId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.campana.volumenConsolidado).toBe(200);
    expect(res.body.cotizaciones).toHaveLength(2);
    expect(res.body.cotizaciones[0].precioUnitario).toBe(1000);
    expect(res.body.cotizaciones[0].costoTotalEstimado).toBe(200000);
  });

  it('campaña que no está en licitación → 409', async () => {
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productoId, tipo: 'COLECTIVA', nombre: `Campana Borrador Adj ${run}`, volumenMinimo: 1,
        fechaApertura: new Date().toISOString(), fechaCierre: new Date(Date.now() + 86400000).toISOString()
      });

    const res = await request(app)
      .get(`/api/adjudicaciones/comparador/${crear.body.campana.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
  });
});

describe('POST /api/adjudicaciones', () => {
  it('adjudica: crea 1 orden por intención, calcula IVA/total y pasa la campaña a ADJUDICADA', async () => {
    const { campanaId } = await crearCampanaConIntencion('adjudicar-ok', { volumen: 100 });
    const proveedor = await crearProveedor('adjudicar-ok');
    const cotizacion = await crearCotizacion(campanaId, proveedor.id, { precioUnitario: 150 });

    const res = await request(app)
      .post('/api/adjudicaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ campanaId, cotizacionGanadoraId: cotizacion.id });

    expect(res.status).toBe(201);
    expect(Number(res.body.adjudicacion.volumenTotalAdjudicado)).toBe(100);

    const campanaActualizada = await prisma.campana.findUnique({ where: { id: campanaId } });
    expect(campanaActualizada.estado).toBe('ADJUDICADA');

    const ordenes = await prisma.ordenCompra.findMany({ where: { adjudicacionId: res.body.adjudicacion.id } });
    expect(ordenes).toHaveLength(1);
    expect(Number(ordenes[0].subtotal)).toBe(100 * 150);
    expect(Number(ordenes[0].iva)).toBeCloseTo(100 * 150 * 0.105, 2);
    expect(Number(ordenes[0].total)).toBeCloseTo(100 * 150 * 1.105, 2);

    const entregas = await prisma.entrega.findMany({ where: { ordenCompraId: ordenes[0].id } });
    expect(entregas).toHaveLength(1);
    expect(entregas[0].estado).toBe('PENDIENTE');

    const cotizacionActualizada = await prisma.cotizacion.findUnique({ where: { id: cotizacion.id } });
    expect(cotizacionActualizada.esGanadora).toBe(true);
  });

  it('con precioMinoristaReferencia calcula ahorro prorrateado por productor', async () => {
    const { campanaId } = await crearCampanaConIntencion('adjudicar-ahorro', { volumen: 50 });
    const proveedor = await crearProveedor('adjudicar-ahorro');
    const cotizacion = await crearCotizacion(campanaId, proveedor.id, { precioUnitario: 100 });

    const res = await request(app)
      .post('/api/adjudicaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ campanaId, cotizacionGanadoraId: cotizacion.id, precioMinoristaReferencia: 120 });

    expect(res.status).toBe(201);
    expect(Number(res.body.adjudicacion.porcentajeAhorro)).toBeCloseTo(16.67, 1);
    expect(Number(res.body.adjudicacion.ahorroEstimadoTotal)).toBeCloseTo((120 - 100) * 50, 2);

    const [orden] = await prisma.ordenCompra.findMany({ where: { adjudicacionId: res.body.adjudicacion.id } });
    expect(Number(orden.ahorroEstimado)).toBeCloseTo((120 - 100) * 50, 2);
    expect(Number(orden.porcentajeAhorro)).toBeCloseTo(16.67, 1);
  });

  it('sin precioMinoristaReferencia, el ahorro queda null (no se inventa)', async () => {
    const { campanaId } = await crearCampanaConIntencion('adjudicar-sin-ahorro');
    const proveedor = await crearProveedor('adjudicar-sin-ahorro');
    const cotizacion = await crearCotizacion(campanaId, proveedor.id);

    const res = await request(app)
      .post('/api/adjudicaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ campanaId, cotizacionGanadoraId: cotizacion.id });

    expect(res.status).toBe(201);
    expect(res.body.adjudicacion.ahorroEstimadoTotal).toBeNull();
    expect(res.body.adjudicacion.porcentajeAhorro).toBeNull();
  });

  it('adjudicar una campaña ya adjudicada → 409, sin crear una segunda Adjudicacion', async () => {
    const { campanaId } = await crearCampanaConIntencion('doble-adjudicacion');
    const proveedor = await crearProveedor('doble-adjudicacion');
    const cotizacion = await crearCotizacion(campanaId, proveedor.id);

    await request(app).post('/api/adjudicaciones').set('Authorization', `Bearer ${adminToken}`).send({ campanaId, cotizacionGanadoraId: cotizacion.id });

    const res = await request(app)
      .post('/api/adjudicaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ campanaId, cotizacionGanadoraId: cotizacion.id });

    expect(res.status).toBe(409);
    const adjudicaciones = await prisma.adjudicacion.findMany({ where: { campanaId } });
    expect(adjudicaciones).toHaveLength(1);
  });

  it('cotización que no pertenece a la campaña → 400, sin efectos secundarios (atomicidad)', async () => {
    const { campanaId } = await crearCampanaConIntencion('cotizacion-ajena');
    const { campanaId: otraCampanaId } = await crearCampanaConIntencion('cotizacion-ajena-otra');
    const proveedor = await crearProveedor('cotizacion-ajena');
    const cotizacionDeOtraCampana = await crearCotizacion(otraCampanaId, proveedor.id);

    const res = await request(app)
      .post('/api/adjudicaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ campanaId, cotizacionGanadoraId: cotizacionDeOtraCampana.id });

    expect(res.status).toBe(400);
    const adjudicaciones = await prisma.adjudicacion.findMany({ where: { campanaId } });
    expect(adjudicaciones).toHaveLength(0);
    const campanaSinTocar = await prisma.campana.findUnique({ where: { id: campanaId } });
    expect(campanaSinTocar.estado).toBe('EN_LICITACION');
  });

  it('un PROVEEDOR no puede adjudicar (403)', async () => {
    const { campanaId } = await crearCampanaConIntencion('rol-proveedor');
    const proveedor = await crearProveedor('rol-proveedor');
    const cotizacion = await crearCotizacion(campanaId, proveedor.id);
    const token = await login(`proveedor-adj-rol-proveedor-${run}@test.com`);

    const res = await request(app)
      .post('/api/adjudicaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({ campanaId, cotizacionGanadoraId: cotizacion.id });

    expect(res.status).toBe(403);
  });
});

describe('procesarAdjudicacionDirecta (materialización de COMPRA_DIRECTA_ADJUDICADA)', () => {
  it('crea Cotizacion sintética ganadora, Adjudicacion, orden y entrega para una DIRECTA', async () => {
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productoId, tipo: 'DIRECTA', nombre: `Directa Adjudicaciones ${run}`, fechaApertura: new Date().toISOString() });
    const campanaId = crear.body.campana.id;
    const proveedor = await crearProveedor('directa');
    const productor = await crearProductor('directa');
    await prisma.intencionCompra.create({ data: { campanaId, productorId: productor.id, productoId, volumen: 80 } });

    await request(app)
      .post(`/api/campanas/${campanaId}/adjudicar-directa`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ proveedorId: proveedor.id, precioUnitario: 300, plazoEntregaDias: 2, condicionesPago: 'Contado' });

    await procesarAdjudicacionDirecta({
      campanaId, proveedorId: proveedor.id, precioUnitario: 300, moneda: 'ARS', plazoEntregaDias: 2, condicionesPago: 'Contado'
    });

    const adjudicacion = await prisma.adjudicacion.findUnique({ where: { campanaId }, include: { cotizacionGanadora: true, ordenes: true } });
    expect(adjudicacion).not.toBeNull();
    expect(adjudicacion.cotizacionGanadora.esGanadora).toBe(true);
    expect(adjudicacion.cotizacionGanadora.proveedorId).toBe(proveedor.id);
    expect(adjudicacion.ordenes).toHaveLength(1);
    expect(Number(adjudicacion.ordenes[0].total)).toBeCloseTo(80 * 300 * 1.105, 2);
  });

  it('es idempotente: procesar el mismo evento dos veces no duplica la adjudicación', async () => {
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productoId, tipo: 'DIRECTA', nombre: `Directa Idempotente ${run}`, fechaApertura: new Date().toISOString() });
    const campanaId = crear.body.campana.id;
    const proveedor = await crearProveedor('directa-idempotente');
    const productor = await crearProductor('directa-idempotente');
    await prisma.intencionCompra.create({ data: { campanaId, productorId: productor.id, productoId, volumen: 10 } });

    await request(app)
      .post(`/api/campanas/${campanaId}/adjudicar-directa`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ proveedorId: proveedor.id, precioUnitario: 50, plazoEntregaDias: 1, condicionesPago: 'Contado' });

    const payload = { campanaId, proveedorId: proveedor.id, precioUnitario: 50, moneda: 'ARS', plazoEntregaDias: 1, condicionesPago: 'Contado' };
    await procesarAdjudicacionDirecta(payload);
    await procesarAdjudicacionDirecta(payload);

    const adjudicaciones = await prisma.adjudicacion.findMany({ where: { campanaId } });
    expect(adjudicaciones).toHaveLength(1);
  });
});
