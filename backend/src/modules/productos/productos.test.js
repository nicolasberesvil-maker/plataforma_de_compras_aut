import bcrypt from 'bcrypt';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';

const run = crypto.randomUUID().slice(0, 8);
const emailsCreados = [];
const nombresCreados = [];

async function crearUsuario(email, rol) {
  emailsCreados.push(email);
  const passwordHash = await bcrypt.hash('clave12345', 4);
  return prisma.usuario.create({
    data: { email, passwordHash, rol, activo: true, nombre: 'Test', apellido: 'User' }
  });
}

async function crearProducto(nombre, overrides = {}) {
  nombresCreados.push(nombre);
  return prisma.producto.create({
    data: {
      nombre,
      categoria: 'AGROQUIMICO',
      unidadMedida: 'LITRO',
      alicuotaIva: 10.5,
      ...overrides
    }
  });
}

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'clave12345' });
  return res.body.accessToken;
}

afterAll(async () => {
  await prisma.campana.deleteMany({ where: { producto: { nombre: { in: nombresCreados } } } });
  await prisma.producto.deleteMany({ where: { nombre: { in: nombresCreados } } });
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('POST /api/productos', () => {
  it('un ADMIN crea un producto exitosamente', async () => {
    const email = `admin-crea-${run}@test.com`;
    await crearUsuario(email, 'ADMIN');
    const token = await login(email);
    const nombre = `Producto Test ${run} A`;
    nombresCreados.push(nombre);

    const res = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre, categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 });

    expect(res.status).toBe(201);
    expect(res.body.producto.nombre).toBe(nombre);
  });

  it('un PRODUCTOR no puede crear (403)', async () => {
    const email = `productor-crea-${run}@test.com`;
    await crearUsuario(email, 'PRODUCTOR');
    const token = await login(email);
    const nombre = `Producto Test ${run} B`;

    const res = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre, categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/productos', () => {
  it('filtra por categoría y search', async () => {
    const email = `admin-lista-${run}@test.com`;
    await crearUsuario(email, 'ADMIN');
    const token = await login(email);
    await crearProducto(`Semilla Soja ${run}`, { categoria: 'SEMILLA', unidadMedida: 'BOLSA' });
    await crearProducto(`Fertilizante Urea ${run}`, { categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA' });

    const res = await request(app)
      .get('/api/productos')
      .query({ categoria: 'SEMILLA', search: run })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((p) => p.categoria === 'SEMILLA')).toBe(true);
    expect(res.body.data.some((p) => p.nombre === `Semilla Soja ${run}`)).toBe(true);
  });
});

describe('DELETE /api/productos/:id', () => {
  it('desactiva el producto (soft delete)', async () => {
    const email = `admin-desact-${run}@test.com`;
    await crearUsuario(email, 'ADMIN');
    const token = await login(email);
    const producto = await crearProducto(`Producto Desactivar ${run}`);

    const res = await request(app)
      .delete(`/api/productos/${producto.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    const actualizado = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(actualizado.activo).toBe(false);
  });

  it('rechaza desactivar si el producto tiene una campaña ABIERTA (409)', async () => {
    const email = `admin-desact-bloq-${run}@test.com`;
    await crearUsuario(email, 'ADMIN');
    const token = await login(email);
    const producto = await crearProducto(`Producto Con Campana ${run}`);
    const admin = await prisma.usuario.findFirstOrThrow({ where: { email } });

    const ahora = new Date();
    await prisma.campana.create({
      data: {
        producto: { connect: { id: producto.id } },
        creadaPor: { connect: { id: admin.id } },
        tipo: 'COLECTIVA',
        nombre: `Campaña Bloqueo ${run}`,
        estado: 'ABIERTA',
        volumenMinimo: 1000,
        fechaApertura: ahora,
        fechaCierre: new Date(ahora.getTime() + 5 * 24 * 60 * 60 * 1000)
      }
    });

    const res = await request(app)
      .delete(`/api/productos/${producto.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);

    const actualizado = await prisma.producto.findUnique({ where: { id: producto.id } });
    expect(actualizado.activo).toBe(true);
  });
});
