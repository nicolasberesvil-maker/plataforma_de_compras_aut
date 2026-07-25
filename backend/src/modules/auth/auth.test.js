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
let cuitSeq = 0;

function datosRegistro(email) {
  cuitSeq += 1;
  return {
    email,
    password: 'clave12345',
    nombre: 'Juan',
    apellido: 'Perez',
    razonSocial: 'Campo Perez SRL',
    cuit: `2030405${String(cuitSeq).padStart(4, '0')}`,
    condicionFiscal: 'MONOTRIBUTISTA',
    domicilioFiscal: 'Ruta 1 km 5',
    localidad: 'Franck'
  };
}

/** Crea un usuario PRODUCTOR ya activo directamente en la DB (sin pasar por /register). */
async function crearUsuarioActivo(email, password) {
  emailsCreados.push(email);
  const passwordHash = await bcrypt.hash(password, 4);
  return prisma.usuario.create({
    data: {
      email,
      passwordHash,
      rol: 'PRODUCTOR',
      activo: true,
      nombre: 'Ana',
      apellido: 'Lopez'
    }
  });
}

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.productor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('registra un productor nuevo (queda inactivo)', async () => {
    const email = `registro-${run}@test.com`;
    emailsCreados.push(email);

    const res = await request(app).post('/api/auth/register').send(datosRegistro(email));

    expect(res.status).toBe(201);
    expect(res.body.usuario.email).toBe(email);
  });

  it('rechaza email duplicado con 409', async () => {
    const email = `duplicado-${run}@test.com`;
    emailsCreados.push(email);

    await request(app).post('/api/auth/register').send(datosRegistro(email));
    const res = await request(app).post('/api/auth/register').send(datosRegistro(email));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('POST /api/auth/login', () => {
  it('loguea con credenciales correctas y devuelve tokens', async () => {
    const email = `login-ok-${run}@test.com`;
    await crearUsuarioActivo(email, 'clave12345');

    const res = await request(app).post('/api/auth/login').send({ email, password: 'clave12345' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
  });

  it('rechaza password incorrecto con 401', async () => {
    const email = `login-badpass-${run}@test.com`;
    await crearUsuarioActivo(email, 'clave12345');

    const res = await request(app).post('/api/auth/login').send({ email, password: 'otra-clave' });

    expect(res.status).toBe(401);
  });

  it('rechaza usuario inactivo con 401 y mensaje claro', async () => {
    const email = `login-inactivo-${run}@test.com`;
    emailsCreados.push(email);
    const passwordHash = await bcrypt.hash('clave12345', 4);
    await prisma.usuario.create({
      data: { email, passwordHash, rol: 'PRODUCTOR', activo: false, nombre: 'A', apellido: 'B' }
    });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'clave12345' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/aprobaci[oó]n/i);
  });
});

describe('POST /api/auth/refresh', () => {
  it('renueva el access token con un refresh token válido', async () => {
    const email = `refresh-ok-${run}@test.com`;
    await crearUsuarioActivo(email, 'clave12345');
    const login = await request(app).post('/api/auth/login').send({ email, password: 'clave12345' });
    const cookie = login.headers['set-cookie'][0];

    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rechaza un refresh token ya usado/revocado con 401', async () => {
    const email = `refresh-revocado-${run}@test.com`;
    await crearUsuarioActivo(email, 'clave12345');
    const login = await request(app).post('/api/auth/login').send({ email, password: 'clave12345' });
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
    await crearUsuarioActivo(email, 'clave12345');
    const login = await request(app).post('/api/auth/login').send({ email, password: 'clave12345' });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.usuario.email).toBe(email);
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
