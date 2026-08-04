import bcrypt from 'bcrypt';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';

const run = crypto.randomUUID().slice(0, 8);
const emailsCreados = [];
const depositoIds = [];
let productoId;
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

async function crearDeposito(nombre) {
  const deposito = await prisma.deposito.create({ data: { nombre, localidad: 'Franck', direccion: 'Ruta 1' } });
  depositoIds.push(deposito.id);
  return deposito;
}

beforeAll(async () => {
  const email = `admin-stock-${run}@test.com`;
  await crearUsuario(email, 'ADMIN');
  adminToken = await login(email);

  const producto = await prisma.producto.create({
    data: { nombre: `Producto Stock Mov ${run}`, categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 }
  });
  productoId = producto.id;
});

afterAll(async () => {
  await prisma.stockMovimiento.deleteMany({ where: { productoId } });
  await prisma.deposito.deleteMany({ where: { id: { in: depositoIds } } });
  await prisma.producto.delete({ where: { id: productoId } });
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('POST /api/stock-movimientos/ingresos', () => {
  it('registra un ingreso y queda auditado con ejecutadoPorId', async () => {
    const deposito = await crearDeposito(`Depósito Ingreso ${run}`);

    const res = await request(app)
      .post('/api/stock-movimientos/ingresos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoId: deposito.id, productoId, cantidad: 50, proveedorOrigen: 'Proveedor X' });

    expect(res.status).toBe(201);
    expect(res.body.movimiento.tipo).toBe('INGRESO_PROVEEDOR');
    expect(res.body.movimiento.signo).toBe(1);
    expect(res.body.movimiento.ejecutadoPorId).toBeDefined();
  });
});

describe('POST /api/stock-movimientos/ajustes', () => {
  it('rechaza un ajuste sin observaciones suficientes', async () => {
    const deposito = await crearDeposito(`Depósito Ajuste Malo ${run}`);

    const res = await request(app)
      .post('/api/stock-movimientos/ajustes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoId: deposito.id, productoId, diferencia: 5, observaciones: 'corto' });

    expect(res.status).toBe(400);
  });

  it('un ajuste positivo y uno negativo mueven el signo correctamente', async () => {
    const deposito = await crearDeposito(`Depósito Ajuste ${run}`);

    const positivo = await request(app)
      .post('/api/stock-movimientos/ajustes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoId: deposito.id, productoId, diferencia: 10, observaciones: 'Conteo físico encontró más stock' });
    expect(positivo.body.movimiento.tipo).toBe('AJUSTE_INVENTARIO_POSITIVO');
    expect(positivo.body.movimiento.signo).toBe(1);

    const negativo = await request(app)
      .post('/api/stock-movimientos/ajustes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoId: deposito.id, productoId, diferencia: -3, observaciones: 'Rotura detectada en conteo físico' });
    expect(negativo.body.movimiento.tipo).toBe('AJUSTE_INVENTARIO_NEGATIVO');
    expect(negativo.body.movimiento.signo).toBe(-1);
  });
});

describe('POST /api/stock-movimientos/transferencias', () => {
  it('genera dos movimientos (salida + entrada) en una transacción', async () => {
    const origen = await crearDeposito(`Depósito Origen ${run}`);
    const destino = await crearDeposito(`Depósito Destino ${run}`);

    await request(app)
      .post('/api/stock-movimientos/ingresos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoId: origen.id, productoId, cantidad: 30 });

    const res = await request(app)
      .post('/api/stock-movimientos/transferencias')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoOrigenId: origen.id, depositoDestinoId: destino.id, productoId, cantidad: 10 });

    expect(res.status).toBe(201);
    expect(res.body.salida.tipo).toBe('TRANSFERENCIA_SALIDA');
    expect(res.body.entrada.tipo).toBe('TRANSFERENCIA_ENTRADA');

    const stockOrigen = await request(app).get(`/api/depositos/${origen.id}/stock`).set('Authorization', `Bearer ${adminToken}`);
    const stockDestino = await request(app).get(`/api/depositos/${destino.id}/stock`).set('Authorization', `Bearer ${adminToken}`);
    expect(stockOrigen.body.data[0].stockActual).toBe(20);
    expect(stockDestino.body.data[0].stockActual).toBe(10);
  });

  it('si la transferencia falla a mitad de camino no deja movimientos huérfanos (rollback)', async () => {
    const origen = await crearDeposito(`Depósito Rollback ${run}`);

    const res = await request(app)
      .post('/api/stock-movimientos/transferencias')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoOrigenId: origen.id, depositoDestinoId: 999999999, productoId, cantidad: 5 });

    expect(res.status).toBe(500);

    const movimientos = await prisma.stockMovimiento.findMany({ where: { depositoId: origen.id, productoId } });
    expect(movimientos).toHaveLength(0);
  });
});

describe('GET /api/stock-movimientos', () => {
  it('lista movimientos filtrados por depósito', async () => {
    const deposito = await crearDeposito(`Depósito Listado ${run}`);
    await request(app)
      .post('/api/stock-movimientos/ingresos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ depositoId: deposito.id, productoId, cantidad: 15 });

    const res = await request(app)
      .get('/api/stock-movimientos')
      .query({ depositoId: deposito.id })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].deposito.nombre).toBe(deposito.nombre);
  });
});
