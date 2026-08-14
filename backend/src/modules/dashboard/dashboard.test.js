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

// Mismo motivo que en facturas.test.js/entregas.test.js: evitar el rate limiter de /auth/login.
function tokenPara(usuario) {
  return jwt.sign({ usuarioId: usuario.id, rol: usuario.rol, email: usuario.email }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

async function crearProductor(sufijo) {
  const email = `productor-dash-${sufijo}-${run}@test.com`;
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
  return { usuario, productor, token };
}

async function crearProveedor(sufijo) {
  const email = `proveedor-dash-${sufijo}-${run}@test.com`;
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
async function crearOrdenParaProductor(sufijo, productor, { volumen = 100, precioUnitario = 100, precioMinoristaReferencia, formaPago } = {}) {
  const crear = await request(app)
    .post('/api/campanas')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      productoId, tipo: 'COLECTIVA', nombre: `Campana Dashboard ${sufijo} ${run}`, volumenMinimo: 1,
      fechaApertura: new Date().toISOString(), fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
    });
  const campanaId = crear.body.campana.id;
  await request(app).post(`/api/campanas/${campanaId}/abrir`).set('Authorization', `Bearer ${adminToken}`);
  await prisma.intencionCompra.create({ data: { campanaId, productorId: productor.id, productoId, volumen } });
  await request(app).post(`/api/campanas/${campanaId}/requisitos-licitacion`).set('Authorization', `Bearer ${adminToken}`).send({
    fechaEstimadaRecepcion: new Date(Date.now() + 10 * 86400000).toISOString(),
    volumenMaximo: 5000,
    modalidadesEntregaOfrecidas: ['RETIRO_EN_DEPOSITO'],
    formasPagoOfrecidas: ['TRANSFERENCIA']
  });
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
    .send({ campanaId, cotizacionGanadoraId: cotizacion.id, precioMinoristaReferencia });

  const [orden] = await prisma.ordenCompra.findMany({ where: { adjudicacionId: adj.body.adjudicacion.id } });
  if (formaPago) await prisma.ordenCompra.update({ where: { id: orden.id }, data: { formaPago } });

  return { orden, adjudicacionId: adj.body.adjudicacion.id, proveedor };
}

beforeAll(async () => {
  const email = `admin-dashboard-${run}@test.com`;
  await crearUsuario(email, 'ADMIN');
  adminToken = await login(email);

  const producto = await prisma.producto.create({
    data: { nombre: `Producto Dashboard ${run}`, categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 }
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

describe('GET /api/dashboard/kpis', () => {
  it('el ahorro acumulado y el volumen reflejan las órdenes creadas', async () => {
    const { productor } = await crearProductor('kpis');
    await crearOrdenParaProductor('kpis', productor, { volumen: 50, precioUnitario: 100, precioMinoristaReferencia: 120 });

    const res = await request(app).get('/api/dashboard/kpis').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ahorroAcumulado).toBeGreaterThanOrEqual((120 - 100) * 50);
    expect(res.body.volumenAcumulado).toBeGreaterThanOrEqual(50);
    expect(res.body.tasaAdopcion).toHaveProperty('porcentaje');
  });

  it('un PRODUCTOR no puede ver los KPIs generales → 403', async () => {
    const { token } = await crearProductor('kpis-sin-permiso');
    const res = await request(app).get('/api/dashboard/kpis').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/dashboard/top-productores', () => {
  it('ordena a los productores por monto total comprado, de mayor a menor', async () => {
    const { productor: p1 } = await crearProductor('top-1');
    await crearOrdenParaProductor('top-1', p1, { volumen: 10, precioUnitario: 50 });

    const { productor: p2 } = await crearProductor('top-2');
    await crearOrdenParaProductor('top-2', p2, { volumen: 500, precioUnitario: 200 });

    const res = await request(app).get('/api/dashboard/top-productores').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.topProductores.map((p) => p.productorId);
    expect(ids.indexOf(p2.id)).toBeLessThan(ids.indexOf(p1.id));
  });
});

describe('GET /api/dashboard/formas-pago', () => {
  it('agrupa las órdenes por forma de pago', async () => {
    const { productor } = await crearProductor('formapago');
    await crearOrdenParaProductor('formapago', productor, { formaPago: 'TRANSFERENCIA' });

    const res = await request(app).get('/api/dashboard/formas-pago').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const fila = res.body.formasPago.find((f) => f.formaPago === 'TRANSFERENCIA');
    expect(fila.cantidad).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/dashboard/volumen-por-insumo', () => {
  it('agrupa el volumen y el monto por producto', async () => {
    const { productor } = await crearProductor('volumen');
    await crearOrdenParaProductor('volumen', productor, { volumen: 30, precioUnitario: 100 });

    const res = await request(app).get('/api/dashboard/volumen-por-insumo').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const fila = res.body.volumen.find((v) => v.productoId === productoId);
    expect(fila.volumenTotal).toBeGreaterThanOrEqual(30);
  });
});

describe('GET /api/dashboard/ranking-proveedores', () => {
  it('cuenta las campañas ganadas por proveedor', async () => {
    const { productor } = await crearProductor('ranking');
    const { proveedor } = await crearOrdenParaProductor('ranking', productor);

    const res = await request(app).get('/api/dashboard/ranking-proveedores').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const fila = res.body.ranking.find((r) => r.proveedorId === proveedor.id);
    expect(fila.campanasGanadas).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/dashboard/balance-iva', () => {
  it('devuelve el balance con saldo e IVA crédito/débito numéricos', async () => {
    const { productor } = await crearProductor('iva');
    await crearOrdenParaProductor('iva', productor, { volumen: 20, precioUnitario: 100 });

    const res = await request(app).get('/api/dashboard/balance-iva').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.ivaCredito).toBe('number');
    expect(typeof res.body.ivaDebito).toBe('number');
    expect(res.body.saldo).toBeCloseTo(res.body.ivaCredito - res.body.ivaDebito, 2);
  });
});

describe('GET /api/dashboard/export', () => {
  it('descarga un Excel válido (.xlsx)', async () => {
    const res = await request(app)
      .get('/api/dashboard/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true).parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // Firma de archivo ZIP (los .xlsx son un ZIP), confirma que el archivo generado no está corrupto.
    expect(res.body.slice(0, 2).toString('hex')).toBe('504b');
  });

  it('un PRODUCTOR no puede exportar el reporte → 403', async () => {
    const { token } = await crearProductor('export-sin-permiso');
    const res = await request(app).get('/api/dashboard/export').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/dashboard/mi', () => {
  it('el productor ve su ahorro acumulado prorrateado y su total gastado', async () => {
    const { productor, token } = await crearProductor('mi-dashboard');
    const { orden } = await crearOrdenParaProductor('mi-dashboard', productor, { volumen: 50, precioUnitario: 100, precioMinoristaReferencia: 120 });

    const res = await request(app).get('/api/dashboard/mi').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cantidadOrdenes).toBe(1);
    expect(res.body.totalGastado).toBeCloseTo(Number(orden.total), 2);
    expect(res.body.ahorroAcumulado).toBeCloseTo((120 - 100) * 50, 2);
  });

  it('un ADMIN no puede acceder al mini-dashboard de productor → 403', async () => {
    const res = await request(app).get('/api/dashboard/mi').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });
});
