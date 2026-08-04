import bcrypt from 'bcrypt';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';

const run = crypto.randomUUID().slice(0, 8);
const emailsCreados = [];
const depositoIds = [];
const productoIds = [];
let adminToken;

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

beforeAll(async () => {
  const email = `admin-depositos-${run}@test.com`;
  await crearUsuario(email, 'ADMIN');
  adminToken = await login(email);
});

afterAll(async () => {
  await prisma.stockMovimiento.deleteMany({ where: { depositoId: { in: depositoIds } } });
  await prisma.deposito.deleteMany({ where: { id: { in: depositoIds } } });
  await prisma.producto.deleteMany({ where: { id: { in: productoIds } } });
  await prisma.proveedor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('POST /api/depositos', () => {
  it('ADMIN crea un depósito sin capacidadMaxima (campo opcional)', async () => {
    const res = await request(app)
      .post('/api/depositos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: `Depósito Test ${run}`, localidad: 'Franck', direccion: 'Ruta 1 km 5' });

    expect(res.status).toBe(201);
    expect(res.body.deposito.activo).toBe(true);
    depositoIds.push(res.body.deposito.id);
  });
});

describe('GET /api/depositos?activo=', () => {
  it('el filtro activo=false devuelve solo depósitos inactivos (no todos)', async () => {
    const crear = await request(app)
      .post('/api/depositos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: `Depósito Inactivo ${run}`, localidad: 'Franck', direccion: 'Ruta 2' });
    const depositoId = crear.body.deposito.id;
    depositoIds.push(depositoId);
    await request(app).delete(`/api/depositos/${depositoId}`).set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get('/api/depositos')
      .query({ activo: 'false' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((d) => d.id === depositoId)).toBe(true);
    expect(res.body.data.every((d) => d.activo === false)).toBe(true);
  });
});

describe('DELETE /api/depositos/:id', () => {
  it('no permite desactivar un depósito con entregas activas', async () => {
    const crear = await request(app)
      .post('/api/depositos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: `Depósito Con Entregas ${run}`, localidad: 'Progreso', direccion: 'Calle 1' });
    const depositoId = crear.body.deposito.id;
    depositoIds.push(depositoId);

    const producto = await prisma.producto.create({
      data: { nombre: `Producto Dep ${run}`, categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 }
    });
    const usuarioProductor = await crearUsuario(`productor-dep-${run}@test.com`, 'PRODUCTOR');
    const productor = await prisma.productor.create({
      data: {
        usuarioId: usuarioProductor.id, razonSocial: 'Campo Test', cuit: `20${run.replace(/\D/g, '').padEnd(9, '1').slice(0, 9)}`,
        condicionFiscal: 'MONOTRIBUTISTA', domicilioFiscal: 'Ruta 1', localidad: 'Franck'
      }
    });
    const campana = await prisma.campana.create({
      data: {
        productoId: producto.id, tipo: 'DIRECTA', nombre: `Campana Dep ${run}`,
        fechaApertura: new Date(), estado: 'ADJUDICADA', creadaPorId: (await prisma.usuario.findUnique({ where: { email: `admin-depositos-${run}@test.com` } })).id
      }
    });
    const cotizacion = await prisma.cotizacion.create({
      data: {
        campanaId: campana.id, proveedorId: (await prisma.proveedor.create({
          data: {
            usuarioId: (await crearUsuario(`proveedor-dep-${run}@test.com`, 'PROVEEDOR')).id,
            razonSocial: 'Insumos Test', cuit: `30${run.replace(/\D/g, '').padEnd(9, '2').slice(0, 9)}`,
            condicionFiscal: 'RESPONSABLE_INSCRIPTO', domicilioFiscal: 'Ruta 9', estadoAprobacion: 'APROBADO'
          }
        })).id,
        precioUnitario: 100, plazoEntregaDias: 5, condicionesPago: 'Contado', validaHasta: new Date(Date.now() + 86400000), esGanadora: true
      }
    });
    const adjudicacion = await prisma.adjudicacion.create({
      data: {
        campanaId: campana.id, cotizacionGanadoraId: cotizacion.id,
        volumenTotalAdjudicado: 10, precioFinalUnitario: 100
      }
    });
    const orden = await prisma.ordenCompra.create({
      data: {
        adjudicacionId: adjudicacion.id, productorId: productor.id,
        volumenFinal: 10, precioUnitario: 100, subtotal: 1000, iva: 105, total: 1105
      }
    });
    await prisma.entrega.create({
      data: {
        ordenCompraId: orden.id, productorId: productor.id, modalidad: 'RETIRO_EN_DEPOSITO',
        estado: 'PENDIENTE', depositoId
      }
    });

    const res = await request(app).delete(`/api/depositos/${depositoId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);

    await prisma.entrega.deleteMany({ where: { ordenCompraId: orden.id } });
    await prisma.ordenCompra.delete({ where: { id: orden.id } });
    await prisma.adjudicacion.delete({ where: { id: adjudicacion.id } });
    await prisma.cotizacion.delete({ where: { id: cotizacion.id } });
    await prisma.campana.delete({ where: { id: campana.id } });
    await prisma.producto.delete({ where: { id: producto.id } });
    await prisma.productor.delete({ where: { id: productor.id } });
  });
});

describe('GET /api/depositos/:id/stock', () => {
  it('calcula el stock actual sumando cantidad * signo', async () => {
    const crear = await request(app)
      .post('/api/depositos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: `Depósito Stock ${run}`, localidad: 'Colonia Nueva', direccion: 'Calle 2' });
    const depositoId = crear.body.deposito.id;
    depositoIds.push(depositoId);

    const producto = await prisma.producto.create({
      data: { nombre: `Producto Stock ${run}`, categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 }
    });
    productoIds.push(producto.id);

    await request(app)
      .post('/api/stock-movimientos/ingresos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoId, productoId: producto.id, cantidad: 100 });
    await request(app)
      .post('/api/stock-movimientos/ajustes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoId, productoId: producto.id, diferencia: -20, observaciones: 'Rotura en conteo físico' });

    const res = await request(app).get(`/api/depositos/${depositoId}/stock`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].stockActual).toBe(80);
  });
});
