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
  return `3050607${String(cuitSeq).padStart(4, '0')}`;
}

async function crearAdmin(email) {
  emailsCreados.push(email);
  const passwordHash = await bcrypt.hash('clave12345', 4);
  return prisma.usuario.create({
    data: { email, passwordHash, rol: 'ADMIN', activo: true, nombre: 'Admin', apellido: 'AUT' }
  });
}

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'clave12345' });
  return res.body.accessToken;
}

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.proveedor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('POST /api/proveedores', () => {
  it('un ADMIN da de alta un proveedor con usuario activo y password temporal', async () => {
    const emailAdmin = `alta-admin-${run}@test.com`;
    await crearAdmin(emailAdmin);
    const token = await login(emailAdmin);

    const emailProveedor = `alta-prov-${run}@test.com`;
    emailsCreados.push(emailProveedor);

    const res = await request(app)
      .post('/api/proveedores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: emailProveedor,
        nombre: 'Carlos',
        apellido: 'Gomez',
        razonSocial: 'Agroquímicos Gomez SA',
        cuit: nuevoCuit(),
        condicionFiscal: 'RESPONSABLE_INSCRIPTO',
        domicilioFiscal: 'Ruta 9 km 20'
      });

    expect(res.status).toBe(201);
    expect(res.body.proveedor.estadoAprobacion).toBe('APROBADO');
    expect(res.body.passwordTemporal).toBeDefined();

    const usuarioCreado = await prisma.usuario.findUnique({ where: { email: emailProveedor } });
    expect(usuarioCreado.activo).toBe(true);
    expect(usuarioCreado.rol).toBe('PROVEEDOR');
  });

  it('rechaza un PRODUCTOR intentando crear proveedores con 403', async () => {
    const email = `noadmin-${run}@test.com`;
    emailsCreados.push(email);
    const passwordHash = await bcrypt.hash('clave12345', 4);
    await prisma.usuario.create({
      data: { email, passwordHash, rol: 'PRODUCTOR', activo: true, nombre: 'A', apellido: 'B' }
    });
    const token = await login(email);

    const res = await request(app)
      .post('/api/proveedores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: `x-${run}@test.com`,
        nombre: 'X',
        apellido: 'Y',
        razonSocial: 'X SA',
        cuit: nuevoCuit(),
        condicionFiscal: 'RESPONSABLE_INSCRIPTO',
        domicilioFiscal: 'Calle falsa 123'
      });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/proveedores/:id/suspender', () => {
  it('suspende a un proveedor aprobado', async () => {
    const emailAdmin = `susp-admin-${run}@test.com`;
    await crearAdmin(emailAdmin);
    const token = await login(emailAdmin);

    const emailProveedor = `susp-prov-${run}@test.com`;
    emailsCreados.push(emailProveedor);
    const alta = await request(app)
      .post('/api/proveedores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: emailProveedor,
        nombre: 'Marta',
        apellido: 'Diaz',
        razonSocial: 'Insumos Diaz SRL',
        cuit: nuevoCuit(),
        condicionFiscal: 'MONOTRIBUTISTA',
        domicilioFiscal: 'Av. Siempreviva 742'
      });

    const res = await request(app)
      .patch(`/api/proveedores/${alta.body.proveedor.id}/suspender`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.proveedor.estadoAprobacion).toBe('SUSPENDIDO');
  });
});
