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
    data: { email, username: email.split('@')[0], passwordHash, rol: 'ADMIN', activo: true, nombre: 'Admin', apellido: 'AUT' }
  });
}

/** Crea un productor ya activo, como hace el ADMIN vía POST /api/productores. */
async function crearProductorActivo(email) {
  emailsCreados.push(email);
  const passwordHash = await bcrypt.hash('clave12345', 4);
  const usuario = await prisma.usuario.create({
    data: { email, username: email.split('@')[0], passwordHash, rol: 'PRODUCTOR', activo: true, nombre: 'Juan', apellido: 'Perez' }
  });
  const productor = await prisma.productor.create({
    data: {
      usuarioId: usuario.id,
      razonSocial: 'Campo Perez SRL',
      cuit: nuevoCuit(),
      condicionFiscal: 'MONOTRIBUTISTA',
      domicilioFiscal: 'Ruta 1 km 5',
      localidad: 'Franck'
    }
  });
  return { usuario, productor };
}

async function login(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'clave12345' });
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

describe('POST /api/productores', () => {
  it('el ADMIN da de alta un productor, que queda activo de inmediato', async () => {
    const emailAdmin = `alta-admin-${run}@test.com`;
    await crearAdmin(emailAdmin);
    const token = await login(emailAdmin.split('@')[0]);

    const res = await request(app)
      .post('/api/productores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username: `alta-prod-${run}`,
        password: 'clave12345',
        email: `alta-prod-${run}@test.com`,
        nombre: 'Juan',
        apellido: 'Perez',
        razonSocial: 'Campo Perez SRL',
        cuit: nuevoCuit(),
        condicionFiscal: 'MONOTRIBUTISTA',
        domicilioFiscal: 'Ruta 1 km 5',
        localidad: 'Franck'
      });
    emailsCreados.push(`alta-prod-${run}@test.com`);

    expect(res.status).toBe(201);
    expect(res.body.usuario.username).toBe(`alta-prod-${run}`);

    const loginNuevo = await login(`alta-prod-${run}`);
    expect(loginNuevo).toBeDefined();
  });

  it('un PRODUCTOR no puede dar de alta productores', async () => {
    const { usuario } = await crearProductorActivo(`noadmin-prod-${run}@test.com`);
    const token = await login(usuario.username);

    const res = await request(app)
      .post('/api/productores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username: `otro-${run}`, password: 'clave12345', email: `otro-${run}@test.com`,
        nombre: 'X', apellido: 'Y', razonSocial: 'Z', cuit: nuevoCuit(),
        condicionFiscal: 'MONOTRIBUTISTA', domicilioFiscal: 'Ruta 1', localidad: 'Franck'
      });

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

    const emailProveedor = `proveedor-ctacte-${sufijo}-${run}@test.com`;
    const usuarioProveedor = await prisma.usuario.create({
      data: {
        email: emailProveedor, username: emailProveedor.split('@')[0], passwordHash: await bcrypt.hash('clave12345', 4),
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
    const adminToken = await login(emailAdmin.split('@')[0]);
    const { productor } = await crearProductorActivo(`ctacte-prod-${run}@test.com`);

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
    const { productor: dueno } = await crearProductorActivo(`ctacte-dueno-${run}@test.com`);
    const { usuario: usuarioOtro } = await crearProductorActivo(`ctacte-otro-${run}@test.com`);
    const tokenOtro = await login(usuarioOtro.username);

    const res = await request(app)
      .get(`/api/productores/${dueno.id}/cuenta-corriente`)
      .set('Authorization', `Bearer ${tokenOtro}`);

    expect(res.status).toBe(403);
  });
});
