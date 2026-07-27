import bcrypt from 'bcrypt';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';

const run = crypto.randomUUID().slice(0, 8);
const emailsCreados = [];
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
