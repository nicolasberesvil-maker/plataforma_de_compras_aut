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

async function crearProveedor(sufijo, { estadoAprobacion = 'APROBADO' } = {}) {
  const email = `proveedor-${sufijo}-${run}@test.com`;
  const usuario = await crearUsuario(email, 'PROVEEDOR');
  cuitSeq += 1;
  const proveedor = await prisma.proveedor.create({
    data: {
      usuarioId: usuario.id,
      razonSocial: `Insumos ${sufijo}`,
      cuit: `30${run.replace(/\D/g, '').padEnd(7, '1').slice(0, 7)}${String(cuitSeq).padStart(2, '0')}`,
      condicionFiscal: 'RESPONSABLE_INSCRIPTO',
      domicilioFiscal: 'Ruta 9',
      estadoAprobacion
    }
  });
  const token = await login(email);
  return { usuario, proveedor, token };
}

async function crearCampanaEnLicitacion(sufijo) {
  const crear = await request(app)
    .post('/api/campanas')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      productoId,
      tipo: 'COLECTIVA',
      nombre: `Campana Cotizaciones ${sufijo} ${run}`,
      volumenMinimo: 1000,
      fechaApertura: new Date().toISOString(),
      fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
    });
  const id = crear.body.campana.id;
  await request(app).post(`/api/campanas/${id}/abrir`).set('Authorization', `Bearer ${adminToken}`);
  await request(app).post(`/api/campanas/${id}/cerrar-intenciones`).set('Authorization', `Bearer ${adminToken}`).send({});
  return id;
}

function datosCotizacion(campanaId, overrides = {}) {
  return {
    campanaId,
    precioUnitario: 1500.5,
    monedaPrecio: 'ARS',
    plazoEntregaDias: 10,
    condicionesPago: '30 días contra factura',
    validaHasta: new Date(Date.now() + 30 * 86400000).toISOString(),
    ...overrides
  };
}

beforeAll(async () => {
  const email = `admin-cotizaciones-${run}@test.com`;
  await crearUsuario(email, 'ADMIN');
  adminToken = await login(email);

  const producto = await prisma.producto.create({
    data: { nombre: `Producto Cotizaciones ${run}`, categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 }
  });
  productoId = producto.id;
});

afterAll(async () => {
  await prisma.cotizacion.deleteMany({ where: { campana: { productoId } } });
  await prisma.intencionCompra.deleteMany({ where: { productoId } });
  await prisma.campana.deleteMany({ where: { productoId } });
  await prisma.producto.delete({ where: { id: productoId } });
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.proveedor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('GET /api/cotizaciones/campanas', () => {
  it('proveedor aprobado ve volumen consolidado, sin intenciones individuales', async () => {
    const { token } = await crearProveedor('lista-ok');
    const campanaId = await crearCampanaEnLicitacion('lista-ok');

    const res = await request(app).get('/api/cotizaciones/campanas').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const campana = res.body.campanas.find((c) => c.id === campanaId);
    expect(campana).toBeDefined();
    expect(campana.volumenConsolidado).toBeDefined();
    expect(campana.intenciones).toBeUndefined();
    expect(campana.yaCotice).toBe(false);
  });

  it('proveedor no aprobado → 403', async () => {
    const { token } = await crearProveedor('no-aprobado', { estadoAprobacion: 'PENDIENTE' });

    const res = await request(app).get('/api/cotizaciones/campanas').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/cotizaciones', () => {
  it('crea una cotización en campaña EN_LICITACION → 201', async () => {
    const { token } = await crearProveedor('crear-ok');
    const campanaId = await crearCampanaEnLicitacion('crear-ok');

    const res = await request(app)
      .post('/api/cotizaciones')
      .set('Authorization', `Bearer ${token}`)
      .send(datosCotizacion(campanaId));

    expect(res.status).toBe(201);
    expect(res.body.cotizacion.campanaId).toBe(campanaId);
  });

  it('rechaza cotizar una campaña que no está en licitación (409)', async () => {
    const { token } = await crearProveedor('no-licitacion');
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productoId,
        tipo: 'COLECTIVA',
        nombre: `Campana Borrador Cotiz ${run}`,
        volumenMinimo: 1000,
        fechaApertura: new Date().toISOString(),
        fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
      });

    const res = await request(app)
      .post('/api/cotizaciones')
      .set('Authorization', `Bearer ${token}`)
      .send(datosCotizacion(crear.body.campana.id));

    expect(res.status).toBe(409);
  });

  it('rechaza cotizar después del plazo de cotización (409)', async () => {
    const { token } = await crearProveedor('plazo-vencido');
    const campanaId = await crearCampanaEnLicitacion('plazo-vencido');
    await prisma.campana.update({
      where: { id: campanaId },
      data: { fechaCierreCotizaciones: new Date(Date.now() - 86400000) }
    });

    const res = await request(app)
      .post('/api/cotizaciones')
      .set('Authorization', `Bearer ${token}`)
      .send(datosCotizacion(campanaId));

    expect(res.status).toBe(409);
  });

  it('rechaza una segunda cotización del mismo proveedor a la misma campaña (409)', async () => {
    const { token } = await crearProveedor('duplicada');
    const campanaId = await crearCampanaEnLicitacion('duplicada');

    await request(app).post('/api/cotizaciones').set('Authorization', `Bearer ${token}`).send(datosCotizacion(campanaId));
    const res = await request(app)
      .post('/api/cotizaciones')
      .set('Authorization', `Bearer ${token}`)
      .send(datosCotizacion(campanaId));

    expect(res.status).toBe(409);
  });
});

describe('GET /api/cotizaciones/:id — sobre cerrado', () => {
  it('un proveedor no puede ver la cotización de otro (403)', async () => {
    const proveedorA = await crearProveedor('sobre-a');
    const proveedorB = await crearProveedor('sobre-b');
    const campanaId = await crearCampanaEnLicitacion('sobre-cerrado');

    const crear = await request(app)
      .post('/api/cotizaciones')
      .set('Authorization', `Bearer ${proveedorA.token}`)
      .send(datosCotizacion(campanaId));

    const res = await request(app)
      .get(`/api/cotizaciones/${crear.body.cotizacion.id}`)
      .set('Authorization', `Bearer ${proveedorB.token}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/cotizaciones/:id', () => {
  it('el proveedor puede editar su cotización mientras esté EN_LICITACION', async () => {
    const { token } = await crearProveedor('editar-ok');
    const campanaId = await crearCampanaEnLicitacion('editar-ok');

    const crear = await request(app)
      .post('/api/cotizaciones')
      .set('Authorization', `Bearer ${token}`)
      .send(datosCotizacion(campanaId));

    const res = await request(app)
      .patch(`/api/cotizaciones/${crear.body.cotizacion.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ precioUnitario: 1600 });

    expect(res.status).toBe(200);
    expect(Number(res.body.cotizacion.precioUnitario)).toBe(1600);
  });
});
