import bcrypt from 'bcrypt';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../app.js';
import { prisma } from '../../config/database.js';

const run = crypto.randomUUID().slice(0, 8);
const emailsCreados = [];
let productoId;
let adminToken;
let contadorCuit = 0;

// El login tiene rate limit (10 intentos / 15 min por IP, ver auth.routes.js)
// y todas las requests de este archivo salen de la misma IP de test: se
// reutiliza un único productor "principal" para todos los casos que no
// necesitan una identidad distinta, y solo se crean productores nuevos
// cuando el test específicamente prueba algo sobre OTRA identidad
// (ownership, agrupar de dos productores distintos).
let tokenPrincipal;

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

async function crearProductor(sufijo) {
  const email = `productor-${sufijo}-${run}@test.com`;
  const usuario = await crearUsuario(email, 'PRODUCTOR');
  contadorCuit += 1;
  const productor = await prisma.productor.create({
    data: {
      usuarioId: usuario.id,
      razonSocial: `Campo ${sufijo}`,
      cuit: `20${run}${String(contadorCuit).padStart(3, '0')}`,
      condicionFiscal: 'MONOTRIBUTISTA',
      domicilioFiscal: 'Ruta 1',
      localidad: 'Franck'
    }
  });
  const token = await login(email);
  return { usuario, productor, token };
}

function datosPedido(overrides = {}) {
  return {
    productoId,
    volumen: 100,
    fechaDeseada: new Date(Date.now() + 86400000).toISOString(),
    modalidadEntregaPreferida: 'RETIRO_EN_DEPOSITO',
    ...overrides
  };
}

function crearPedido(token, overrides = {}) {
  return request(app).post('/api/intenciones').set('Authorization', `Bearer ${token}`).send(datosPedido(overrides));
}

beforeAll(async () => {
  const adminEmail = `admin-intenciones-${run}@test.com`;
  await crearUsuario(adminEmail, 'ADMIN');
  adminToken = await login(adminEmail);

  const producto = await prisma.producto.create({
    data: { nombre: `Producto Intenciones ${run}`, categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 }
  });
  productoId = producto.id;

  const principal = await crearProductor('principal');
  tokenPrincipal = principal.token;
});

afterAll(async () => {
  await prisma.intencionCompra.deleteMany({ where: { productoId } });
  await prisma.campana.deleteMany({ where: { productoId } });
  await prisma.producto.delete({ where: { id: productoId } });
  await prisma.refreshToken.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.productor.deleteMany({ where: { usuario: { email: { in: emailsCreados } } } });
  await prisma.usuario.deleteMany({ where: { email: { in: emailsCreados } } });
  await prisma.$disconnect();
});

describe('POST /api/intenciones — pedido suelto (bottom-up)', () => {
  it('productor aprobado carga un pedido suelto → 201 PENDIENTE, sin campaña', async () => {
    const res = await crearPedido(tokenPrincipal, { volumen: 500 });

    expect(res.status).toBe(201);
    expect(res.body.intencion.estado).toBe('PENDIENTE');
    expect(res.body.intencion.campanaId).toBeNull();
  });

  it('sin fechaDeseada/modalidad (pedido suelto) → 400', async () => {
    const res = await request(app)
      .post('/api/intenciones')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .send({ productoId, volumen: 500 });
    expect(res.status).toBe(400);
  });

  it('ENTREGA_EN_CAMPO sin dirección → 400', async () => {
    const res = await crearPedido(tokenPrincipal, { modalidadEntregaPreferida: 'ENTREGA_EN_CAMPO' });
    expect(res.status).toBe(400);
  });

  it('permite varios pedidos sueltos del mismo productor/producto', async () => {
    const res1 = await crearPedido(tokenPrincipal, { volumen: 111 });
    const res2 = await crearPedido(tokenPrincipal, { volumen: 112 });
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
  });
});

describe('PATCH/DELETE /api/intenciones/:id — pedido suelto', () => {
  it('editar/eliminar un pedido ya DESCARTADO → 409', async () => {
    const crear = await crearPedido(tokenPrincipal, { volumen: 200 });
    const id = crear.body.intencion.id;

    await request(app)
      .post(`/api/intenciones/${id}/descartar`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ motivo: 'No hay volumen suficiente en la zona' });

    const patch = await request(app)
      .patch(`/api/intenciones/${id}`)
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .send({ volumen: 300 });
    expect(patch.status).toBe(409);

    const del = await request(app).delete(`/api/intenciones/${id}`).set('Authorization', `Bearer ${tokenPrincipal}`);
    expect(del.status).toBe(409);
  });

  it('editar la intención de otro productor → 403', async () => {
    const { token: tokenIntruso } = await crearProductor('intruso');
    const crear = await crearPedido(tokenPrincipal, { volumen: 200 });
    const id = crear.body.intencion.id;

    const patch = await request(app)
      .patch(`/api/intenciones/${id}`)
      .set('Authorization', `Bearer ${tokenIntruso}`)
      .send({ volumen: 300 });
    expect(patch.status).toBe(403);
  });
});

describe('POST /api/intenciones/agrupar', () => {
  it('agrupa 2 pedidos sueltos del mismo producto en 1 Campana ABIERTA', async () => {
    const { token: token2 } = await crearProductor('agrupar-2');
    const pedido1 = await crearPedido(tokenPrincipal, { volumen: 300 });
    const pedido2 = await crearPedido(token2, { volumen: 300 });

    const res = await request(app)
      .post('/api/intenciones/agrupar')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        intencionIds: [pedido1.body.intencion.id, pedido2.body.intencion.id],
        nombre: `Agrupada ${run}`,
        fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
      });

    expect(res.status).toBe(201);
    expect(res.body.campana.estado).toBe('ABIERTA');

    const intencion1 = await prisma.intencionCompra.findUnique({ where: { id: pedido1.body.intencion.id } });
    expect(intencion1.estado).toBe('AGRUPADA');
    expect(intencion1.campanaId).toBe(res.body.campana.id);
  });

  it('rechaza agrupar pedidos de productos distintos → 400', async () => {
    const otroProducto = await prisma.producto.create({
      data: { nombre: `Producto Otro ${run}`, categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 21 }
    });

    const pedido1 = await crearPedido(tokenPrincipal, { volumen: 100 });
    const pedido2 = await crearPedido(tokenPrincipal, { productoId: otroProducto.id, volumen: 100 });

    const res = await request(app)
      .post('/api/intenciones/agrupar')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        intencionIds: [pedido1.body.intencion.id, pedido2.body.intencion.id],
        nombre: `Mixta ${run}`,
        fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
      });

    expect(res.status).toBe(400);

    await prisma.intencionCompra.deleteMany({ where: { productoId: otroProducto.id } });
    await prisma.producto.delete({ where: { id: otroProducto.id } });
  });

  it('rechaza agrupar un pedido ya AGRUPADA → 400', async () => {
    const pedido = await crearPedido(tokenPrincipal, { volumen: 150 });

    await request(app).post('/api/intenciones/agrupar').set('Authorization', `Bearer ${adminToken}`).send({
      intencionIds: [pedido.body.intencion.id],
      nombre: `Re-agrupar 1 ${run}`,
      fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
    });

    const res = await request(app)
      .post('/api/intenciones/agrupar')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        intencionIds: [pedido.body.intencion.id],
        nombre: `Re-agrupar 2 ${run}`,
        fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
      });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/intenciones/:id/descartar', () => {
  it('descarta un pedido PENDIENTE → 200 DESCARTADA + motivo', async () => {
    const pedido = await crearPedido(tokenPrincipal, { volumen: 80 });

    const res = await request(app)
      .post(`/api/intenciones/${pedido.body.intencion.id}/descartar`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ motivo: 'Volumen insuficiente para armar requerimiento' });

    expect(res.status).toBe(200);
    expect(res.body.intencion.estado).toBe('DESCARTADA');
    expect(res.body.intencion.motivoDescarte).toBe('Volumen insuficiente para armar requerimiento');
  });
});

describe('Intenciones dentro de una campaña (top-down)', () => {
  async function crearCampanaAbierta() {
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productoId,
        tipo: 'COLECTIVA',
        nombre: `Campana Intenciones ${run}-${crypto.randomUUID().slice(0, 4)}`,
        volumenMinimo: 1000,
        fechaApertura: new Date().toISOString(),
        fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
      });
    const id = crear.body.campana.id;
    await request(app).post(`/api/campanas/${id}/abrir`).set('Authorization', `Bearer ${adminToken}`);
    return id;
  }

  it('cargar intención en campaña no ABIERTA → 409', async () => {
    const crear = await request(app)
      .post('/api/campanas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productoId,
        tipo: 'COLECTIVA',
        nombre: `Campana Borrador ${run}`,
        volumenMinimo: 1000,
        fechaApertura: new Date().toISOString(),
        fechaCierre: new Date(Date.now() + 5 * 86400000).toISOString()
      });

    const res = await request(app)
      .post('/api/intenciones')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .send({ campanaId: crear.body.campana.id, volumen: 500 });

    expect(res.status).toBe(409);
  });

  it('carga intención en campaña ABIERTA → 201; segunda vez → 409', async () => {
    const campanaId = await crearCampanaAbierta();

    const res1 = await request(app)
      .post('/api/intenciones')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .send({ campanaId, volumen: 500 });
    expect(res1.status).toBe(201);
    expect(res1.body.intencion.campanaId).toBe(campanaId);

    const res2 = await request(app)
      .post('/api/intenciones')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .send({ campanaId, volumen: 200 });
    expect(res2.status).toBe(409);
  });

  it('eliminar intención propia dentro de campaña ABIERTA → 204', async () => {
    const campanaId = await crearCampanaAbierta();

    const crear = await request(app)
      .post('/api/intenciones')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .send({ campanaId, volumen: 500 });

    const res = await request(app)
      .delete(`/api/intenciones/${crear.body.intencion.id}`)
      .set('Authorization', `Bearer ${tokenPrincipal}`);
    expect(res.status).toBe(204);
  });
});
