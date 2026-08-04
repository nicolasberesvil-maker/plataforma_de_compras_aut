import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';
import { requireRole } from '../../middlewares/auth.middleware.js';

// Sufijo único por corrida para no chocar con datos de corridas previas.
const run = crypto.randomUUID().slice(0, 8);
const emailsCreados = [];

/** Crea un usuario PRODUCTOR ya activo directamente en la DB (alta manual, como hace el ADMIN). */
async function crearUsuarioActivo(email, password) {
  emailsCreados.push(email);
  const passwordHash = await bcrypt.hash(password, 4);
  return prisma.usuario.create({
    data: {
      email,
      username: email.split('@')[0],
      passwordHash,
      rol: 'PRODUCTOR',
      activo: true,
      nombre: 'Ana',
      apellido: 'Lopez'
    }
  });
}

afterAll(async () => {
  await prisma.passwordResetToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.productor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('loguea con credenciales correctas y devuelve tokens', async () => {
    const email = `login-ok-${run}@test.com`;
    const usuario = await crearUsuarioActivo(email, 'clave12345');

    const res = await request(app).post('/api/auth/login').send({ username: usuario.username, password: 'clave12345' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
  });

  it('rechaza password incorrecto con 401', async () => {
    const email = `login-badpass-${run}@test.com`;
    const usuario = await crearUsuarioActivo(email, 'clave12345');

    const res = await request(app).post('/api/auth/login').send({ username: usuario.username, password: 'otra-clave' });

    expect(res.status).toBe(401);
  });

  it('rechaza usuario inactivo con 401', async () => {
    const email = `login-inactivo-${run}@test.com`;
    emailsCreados.push(email);
    const username = email.split('@')[0];
    const passwordHash = await bcrypt.hash('clave12345', 4);
    await prisma.usuario.create({
      data: { email, username, passwordHash, rol: 'PRODUCTOR', activo: false, nombre: 'A', apellido: 'B' }
    });

    const res = await request(app).post('/api/auth/login').send({ username, password: 'clave12345' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('renueva el access token con un refresh token válido', async () => {
    const email = `refresh-ok-${run}@test.com`;
    const usuario = await crearUsuarioActivo(email, 'clave12345');
    const login = await request(app).post('/api/auth/login').send({ username: usuario.username, password: 'clave12345' });
    const cookie = login.headers['set-cookie'][0];

    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rechaza un refresh token ya usado/revocado con 401', async () => {
    const email = `refresh-revocado-${run}@test.com`;
    const usuario = await crearUsuarioActivo(email, 'clave12345');
    const login = await request(app).post('/api/auth/login').send({ username: usuario.username, password: 'clave12345' });
    const cookie = login.headers['set-cookie'][0];

    // La rotación revoca el token usado, así que reusarlo debe fallar.
    await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('rechaza requests sin token con 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('devuelve el usuario autenticado con un token válido', async () => {
    const email = `me-${run}@test.com`;
    const usuario = await crearUsuarioActivo(email, 'clave12345');
    const login = await request(app).post('/api/auth/login').send({ username: usuario.username, password: 'clave12345' });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.usuario.email).toBe(email);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('responde 200 aunque el email no exista (no filtra qué emails están registrados)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: `no-existe-${run}@test.com` });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('rechaza un token inválido con 400', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'token-que-no-existe', nuevaPassword: 'nuevaClave123' });

    expect(res.status).toBe(400);
  });

  it('con un token válido cambia la contraseña, lo marca usado y revoca refresh tokens', async () => {
    const email = `reset-ok-${run}@test.com`;
    const usuario = await crearUsuarioActivo(email, 'clave12345');
    const login = await request(app).post('/api/auth/login').send({ username: usuario.username, password: 'clave12345' });
    const refreshCookie = login.headers['set-cookie'][0];

    const tokenPlano = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenPlano).digest('hex');
    await prisma.passwordResetToken.create({
      data: { usuarioId: usuario.id, tokenHash, expiraAt: new Date(Date.now() + 60 * 60 * 1000) }
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: tokenPlano, nuevaPassword: 'claveNueva123' });
    expect(res.status).toBe(200);

    const loginViejo = await request(app).post('/api/auth/login').send({ username: usuario.username, password: 'clave12345' });
    expect(loginViejo.status).toBe(401);

    const loginNuevo = await request(app).post('/api/auth/login').send({ username: usuario.username, password: 'claveNueva123' });
    expect(loginNuevo.status).toBe(200);

    const refreshViejo = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    expect(refreshViejo.status).toBe(401);

    const reusar = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: tokenPlano, nuevaPassword: 'otraClave123' });
    expect(reusar.status).toBe(400);
  });
});

describe('requireRole', () => {
  it('responde 403 cuando el rol del usuario no está permitido', () => {
    const req = { usuario: { id: 1, rol: 'PRODUCTOR' } };
    const next = jest.fn();

    requireRole(['ADMIN'])(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('llama a next() sin error cuando el rol está permitido', () => {
    const req = { usuario: { id: 1, rol: 'ADMIN' } };
    const next = jest.fn();

    requireRole(['ADMIN'])(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});
