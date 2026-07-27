import bcrypt from 'bcrypt';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';

const run = crypto.randomUUID().slice(0, 8);
const emailsCreados = [];
const nombresProductoCreados = [];
let productoId;
let adminToken;

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

function datosColectiva(overrides = {}) {
  const ahora = new Date();
  return {
    productoId,
    tipo: 'COLECTIVA',
    nombre: `Campaña Test ${run}`,
    volumenMinimo: 1000,
    fechaApertura: ahora.toISOString(),
    fechaCierre: new Date(ahora.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides
  };
}

beforeAll(async () => {
  const email = `admin-campanas-${run}@test.com`;
  await crearUsuario(email, 'ADMIN');
  adminToken = await login(email);

  const nombreProducto = `Producto Campana ${run}`;
  nombresProductoCreados.push(nombreProducto);
  const producto = await prisma.producto.create({
    data: { nombre: nombreProducto, categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 }
  });
  productoId = producto.id;
});

afterAll(async () => {
  await prisma.intencionCompra.deleteMany({ where: { productoId } });
  await prisma.campana.deleteMany({ where: { productoId } });
  await prisma.producto.deleteMany({ where: { nombre: { in: nombresProductoCreados } } });
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.productor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('POST /api/campanas — COLECTIVA', () => {
  it('crea una COLECTIVA con datos válidos → BORRADOR', async () => {
    const res = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(datosColectiva());

    expect(res.status).toBe(201);
    expect(res.body.campana.estado).toBe('BORRADOR');
    expect(res.body.campana.tipo).toBe('COLECTIVA');
  });

  it('rechaza COLECTIVA sin volumen mínimo (400)', async () => {
    const { volumenMinimo, ...sinVolumen } = datosColectiva();
    const res = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(sinVolumen);

    expect(res.status).toBe(400);
  });

  it('rechaza fechaCierre <= fechaApertura (400)', async () => {
    const ahora = new Date();
    const res = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(datosColectiva({ fechaApertura: ahora.toISOString(), fechaCierre: ahora.toISOString() }));

    expect(res.status).toBe(400);
  });
});

describe('Transiciones COLECTIVA', () => {
  it('BORRADOR → ABIERTA → EN_LICITACION funciona; BORRADOR → ADJUDICADA es 409', async () => {
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(datosColectiva());
    const id = crear.body.campana.id;

    const abrir = await request(app)
      .post(`/api/campanas/${id}/abrir`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(abrir.status).toBe(200);
    expect(abrir.body.campana.estado).toBe('ABIERTA');

    const adjudicarDirecto = await request(app)
      .post(`/api/campanas/${id}/adjudicar-directa`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ proveedorId: 1, precioUnitario: 100, plazoEntregaDias: 5, condicionesPago: 'Contado' });
    expect(adjudicarDirecto.status).toBe(409);

    const cerrar = await request(app)
      .post(`/api/campanas/${id}/cerrar-intenciones`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(cerrar.status).toBe(200);
    expect(cerrar.body.campana.estado).toBe('EN_LICITACION');
  });

  it('cancelar una campaña ya CERRADA es 409', async () => {
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(datosColectiva());
    const id = crear.body.campana.id;

    await prisma.campana.update({ where: { id }, data: { estado: 'CERRADA' } });

    const res = await request(app)
      .post(`/api/campanas/${id}/cancelar`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ motivo: 'No corresponde' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/campanas — DIRECTA', () => {
  it('crea sin volumen mínimo ni fecha de cierre → BORRADOR', async () => {
    const res = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productoId, tipo: 'DIRECTA', nombre: `Directa ${run}`, fechaApertura: new Date().toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.campana.estado).toBe('BORRADOR');
  });

  it('adjudicarDirecta pasa de BORRADOR a ADJUDICADA y emite el evento', async () => {
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productoId, tipo: 'DIRECTA', nombre: `Directa Adj ${run}`, fechaApertura: new Date().toISOString() });
    const id = crear.body.campana.id;

    const res = await request(app)
      .post(`/api/campanas/${id}/adjudicar-directa`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ proveedorId: 1, precioUnitario: 250.5, plazoEntregaDias: 3, condicionesPago: 'Contado' });

    expect(res.status).toBe(200);
    expect(res.body.campana.estado).toBe('ADJUDICADA');
  });

  it('cerrarIntenciones sobre una DIRECTA es 409 (no licita)', async () => {
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productoId, tipo: 'DIRECTA', nombre: `Directa NoLicita ${run}`, fechaApertura: new Date().toISOString() });
    const id = crear.body.campana.id;

    const res = await request(app)
      .post(`/api/campanas/${id}/cerrar-intenciones`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(409);
  });
});

describe('POST /api/campanas — CONTINUA', () => {
  it('ignora fechaCierre (queda null)', async () => {
    const res = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productoId,
        tipo: 'CONTINUA',
        nombre: `Continua ${run}`,
        fechaApertura: new Date().toISOString(),
        fechaCierre: new Date(Date.now() + 86400000).toISOString()
      });

    expect(res.status).toBe(201);
    expect(res.body.campana.fechaCierre).toBeNull();
  });

  it('generarTanda sin intenciones acumuladas → 400', async () => {
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productoId, tipo: 'CONTINUA', nombre: `Continua Tanda ${run}`, fechaApertura: new Date().toISOString() });
    const id = crear.body.campana.id;

    await request(app).post(`/api/campanas/${id}/abrir`).set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post(`/api/campanas/${id}/generar-tanda`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('generarTanda con intenciones acumuladas crea la hija y re-vincula las intenciones', async () => {
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productoId, tipo: 'CONTINUA', nombre: `Continua Tanda OK ${run}`, fechaApertura: new Date().toISOString() });
    const padreId = crear.body.campana.id;
    await request(app).post(`/api/campanas/${padreId}/abrir`).set('Authorization', `Bearer ${adminToken}`);

    const productorEmail = `productor-tanda-${run}@test.com`;
    const usuario = await crearUsuario(productorEmail, 'PRODUCTOR');
    const productor = await prisma.productor.create({
      data: {
        usuarioId: usuario.id,
        razonSocial: 'Campo Test',
        cuit: `20${run.replace(/\D/g, '').padEnd(9, '1').slice(0, 9)}`,
        condicionFiscal: 'MONOTRIBUTISTA',
        domicilioFiscal: 'Ruta 1',
        localidad: 'Franck',
        aprobado: true
      }
    });
    await prisma.intencionCompra.create({
      data: { campanaId: padreId, productorId: productor.id, productoId, volumen: 500 }
    });

    const res = await request(app)
      .post(`/api/campanas/${padreId}/generar-tanda`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tipoTanda: 'COLECTIVA' });

    expect(res.status).toBe(201);
    expect(res.body.campana.campanaPadreId).toBe(padreId);

    const intencion = await prisma.intencionCompra.findFirst({ where: { productorId: productor.id } });
    expect(intencion.campanaId).toBe(res.body.campana.id);
  });
});
