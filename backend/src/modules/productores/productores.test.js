import bcrypt from 'bcrypt';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';

const run = crypto.randomUUID().slice(0, 8);
const emailsCreados = [];
const productoIdsCtaCte = [];
let cuitSeq = 0;

function nuevoCuit() {
  cuitSeq += 1;
  return `2040506${String(cuitSeq).padStart(4, '0')}`;
}

async function crearAdmin(email) {
  emailsCreados.push(email);
  const passwordHash = await bcrypt.hash('clave12345', 4);
  return prisma.usuario.create({
    data: { email, passwordHash, rol: 'ADMIN', activo: true, nombre: 'Admin', apellido: 'AUT' }
  });
}

async function crearProductorPendiente(email) {
  emailsCreados.push(email);
  const passwordHash = await bcrypt.hash('clave12345', 4);
  const usuario = await prisma.usuario.create({
    data: { email, passwordHash, rol: 'PRODUCTOR', activo: false, nombre: 'Juan', apellido: 'Perez' }
  });
  const productor = await prisma.productor.create({
    data: {
      usuarioId: usuario.id,
      razonSocial: 'Campo Perez SRL',
      cuit: nuevoCuit(),
      condicionFiscal: 'MONOTRIBUTISTA',
      domicilioFiscal: 'Ruta 1 km 5',
      localidad: 'Franck',
      aprobado: false
    }
  });
  return { usuario, productor };
}

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'clave12345' });
  return res.body.accessToken;
}

afterAll(async () => {
  if (productoIdsCtaCte.length > 0) {
    const campanas = await prisma.campana.findMany({ where: { productoId: { in: productoIdsCtaCte } }, select: { id: true } });
    const campanaIds = campanas.map((c) => c.id);
    await prisma.entrega.deleteMany({ where: { ordenCompra: { adjudicacion: { campanaId: { in: campanaIds } } } } });
    await prisma.ordenCompra.deleteMany({ where: { adjudicacion: { campanaId: { in: campanaIds } } } });
    await prisma.adjudicacion.deleteMany({ where: { campanaId: { in: campanaIds } } });
    await prisma.cotizacion.deleteMany({ where: { campanaId: { in: campanaIds } } });
    await prisma.intencionCompra.deleteMany({ where: { productoId: { in: productoIdsCtaCte } } });
    await prisma.campana.deleteMany({ where: { productoId: { in: productoIdsCtaCte } } });
    await prisma.proveedor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
    await prisma.producto.deleteMany({ where: { id: { in: productoIdsCtaCte } } });
  }
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.productor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('GET /api/productores/pendientes', () => {
  it('un ADMIN ve la lista de productores pendientes de aprobación', async () => {
    const emailAdmin = `pend-admin-${run}@test.com`;
    await crearAdmin(emailAdmin);
    const { usuario } = await crearProductorPendiente(`pend-prod-${run}@test.com`);
    const token = await login(emailAdmin);

    const res = await request(app).get('/api/productores/pendientes').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((p) => p.usuarioId === usuario.id)).toBe(true);
  });
});

describe('PATCH /api/productores/:id/aprobar', () => {
  it('aprueba al productor y activa su usuario', async () => {
    const emailAdmin = `aprobar-admin-${run}@test.com`;
    await crearAdmin(emailAdmin);
    const { usuario, productor } = await crearProductorPendiente(`aprobar-prod-${run}@test.com`);
    const token = await login(emailAdmin);

    const res = await request(app)
      .patch(`/api/productores/${productor.id}/aprobar`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.productor.aprobado).toBe(true);

    const usuarioActualizado = await prisma.usuario.findUnique({ where: { id: usuario.id } });
    expect(usuarioActualizado.activo).toBe(true);
  });

  it('rechaza aprobar dos veces con 409', async () => {
    const emailAdmin = `doble-admin-${run}@test.com`;
    await crearAdmin(emailAdmin);
    const { productor } = await crearProductorPendiente(`doble-prod-${run}@test.com`);
    const token = await login(emailAdmin);

    await request(app).patch(`/api/productores/${productor.id}/aprobar`).set('Authorization', `Bearer ${token}`);
    const res = await request(app).patch(`/api/productores/${productor.id}/aprobar`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('un PRODUCTOR no puede aprobar', async () => {
    const { usuario, productor } = await crearProductorPendiente(`noadmin-prod-${run}@test.com`);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { activo: true } });
    const token = await login(usuario.email);

    const res = await request(app)
      .patch(`/api/productores/${productor.id}/aprobar`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/productores/:id/cuenta-corriente', () => {
  async function crearOrdenParaProductor(sufijo, productor, adminToken) {
    const producto = await prisma.producto.create({
      data: { nombre: `Producto CtaCte ${sufijo} ${run}`, categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 }
    });
    productoIdsCtaCte.push(producto.id);
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productoId: producto.id, tipo: 'COLECTIVA', nombre: `Campana CtaCte ${sufijo} ${run}`, volumenMinimo: 1,
        fechaApertura: new Date().toISOString(), fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
      });
    const campanaId = crear.body.campana.id;
    await request(app).post(`/api/campanas/${campanaId}/abrir`).set('Authorization', `Bearer ${adminToken}`);
    await prisma.intencionCompra.create({ data: { campanaId, productorId: productor.id, productoId: producto.id, volumen: 50 } });
    await request(app).post(`/api/campanas/${campanaId}/cerrar-intenciones`).set('Authorization', `Bearer ${adminToken}`).send({});

    const usuarioProveedor = await prisma.usuario.create({
      data: {
        email: `proveedor-ctacte-${sufijo}-${run}@test.com`, passwordHash: await bcrypt.hash('clave12345', 4),
        rol: 'PROVEEDOR', activo: true, nombre: 'Prov', apellido: 'Test'
      }
    });
    emailsCreados.push(usuarioProveedor.email);
    const proveedor = await prisma.proveedor.create({
      data: {
        usuarioId: usuarioProveedor.id, razonSocial: `Insumos ${sufijo}`, cuit: nuevoCuit(),
        condicionFiscal: 'RESPONSABLE_INSCRIPTO', domicilioFiscal: 'Ruta 9', estadoAprobacion: 'APROBADO'
      }
    });
    const cotizacion = await prisma.cotizacion.create({
      data: {
        campanaId, proveedorId: proveedor.id, precioUnitario: 200, monedaPrecio: 'ARS', plazoEntregaDias: 5,
        condicionesPago: 'Contado', validaHasta: new Date(Date.now() + 86400000)
      }
    });
    await request(app)
      .post('/api/adjudicaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ campanaId, cotizacionGanadoraId: cotizacion.id });

    return producto.id;
  }

  it('el ADMIN ve el resumen consolidado de compras del productor', async () => {
    const emailAdmin = `ctacte-admin-${run}@test.com`;
    await crearAdmin(emailAdmin);
    const adminToken = await login(emailAdmin);
    const { usuario, productor } = await crearProductorPendiente(`ctacte-prod-${run}@test.com`);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { activo: true } });
    await prisma.productor.update({ where: { id: productor.id }, data: { aprobado: true } });

    await crearOrdenParaProductor('resumen', productor, adminToken);

    const res = await request(app)
      .get(`/api/productores/${productor.id}/cuenta-corriente`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.porOrden).toHaveLength(1);
    expect(res.body.porOrden[0].volumenPendiente).toBe(50);
    expect(res.body.resumen.totalPendienteEntrega).toBe(res.body.porOrden[0].montoTotal);
  });

  it('un productor no puede ver la cuenta corriente de otro productor (403)', async () => {
    const { usuario: usuarioDueno, productor: dueno } = await crearProductorPendiente(`ctacte-dueno-${run}@test.com`);
    await prisma.usuario.update({ where: { id: usuarioDueno.id }, data: { activo: true } });
    const { usuario: usuarioOtro } = await crearProductorPendiente(`ctacte-otro-${run}@test.com`);
    await prisma.usuario.update({ where: { id: usuarioOtro.id }, data: { activo: true } });
    const tokenOtro = await login(usuarioOtro.email);

    const res = await request(app)
      .get(`/api/productores/${dueno.id}/cuenta-corriente`)
      .set('Authorization', `Bearer ${tokenOtro}`);

    expect(res.status).toBe(403);
  });
});
