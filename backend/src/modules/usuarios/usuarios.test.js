import bcrypt from 'bcrypt';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';

const run = crypto.randomUUID().slice(0, 8);
const emailsCreados = [];

async function crearUsuario(email, { rol = 'PRODUCTOR', activo = true } = {}) {
  emailsCreados.push(email);
  const passwordHash = await bcrypt.hash('clave12345', 4);
  return prisma.usuario.create({
    data: { email, passwordHash, rol, activo, nombre: 'Test', apellido: 'User' }
  });
}

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'clave12345' });
  return res.body.accessToken;
}

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('GET /api/usuarios', () => {
  it('rechaza a un usuario que no es ADMIN con 403', async () => {
    const email = `list-noadmin-${run}@test.com`;
    await crearUsuario(email);
    const token = await login(email);

    const res = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('un ADMIN lista todos los usuarios', async () => {
    const email = `list-admin-${run}@test.com`;
    await crearUsuario(email, { rol: 'ADMIN' });
    const token = await login(email);

    const res = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });
});

describe('GET /api/usuarios/:id', () => {
  it('un usuario común solo puede ver sus propios datos', async () => {
    const emailA = `own-a-${run}@test.com`;
    const emailB = `own-b-${run}@test.com`;
    const usuarioA = await crearUsuario(emailA);
    await crearUsuario(emailB);
    const tokenA = await login(emailA);

    const res = await request(app).get(`/api/usuarios/${usuarioA.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.usuario.email).toBe(emailA);

    const usuarioB = await prisma.usuario.findUnique({ where: { email: emailB } });
    const resAjeno = await request(app).get(`/api/usuarios/${usuarioB.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(resAjeno.status).toBe(403);
  });
});

describe('PATCH /api/usuarios/:id/activar y /desactivar', () => {
  it('un ADMIN puede desactivar y reactivar un usuario', async () => {
    const emailAdmin = `estado-admin-${run}@test.com`;
    const emailTarget = `estado-target-${run}@test.com`;
    await crearUsuario(emailAdmin, { rol: 'ADMIN' });
    const target = await crearUsuario(emailTarget);
    const tokenAdmin = await login(emailAdmin);

    const resDesactivar = await request(app)
      .patch(`/api/usuarios/${target.id}/desactivar`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(resDesactivar.status).toBe(200);
    expect(resDesactivar.body.usuario.activo).toBe(false);

    const resActivar = await request(app)
      .patch(`/api/usuarios/${target.id}/activar`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(resActivar.status).toBe(200);
    expect(resActivar.body.usuario.activo).toBe(true);
  });
});

describe('POST /api/usuarios/:id/cambiar-password', () => {
  it('requiere la password actual correcta', async () => {
    const email = `pass-${run}@test.com`;
    const usuario = await crearUsuario(email);
    const token = await login(email);

    const resMalo = await request(app)
      .post(`/api/usuarios/${usuario.id}/cambiar-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ passwordActual: 'incorrecta', passwordNueva: 'nuevaClave123' });
    expect(resMalo.status).toBe(403);

    const resOk = await request(app)
      .post(`/api/usuarios/${usuario.id}/cambiar-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ passwordActual: 'clave12345', passwordNueva: 'nuevaClave123' });
    expect(resOk.status).toBe(204);
  });
});
