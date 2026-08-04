import { prisma } from '../../config/database.js';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';
import { montoConfirmadoPorOrden } from '../productores/productores.cuenta-corriente.js';

const INCLUDE_DETALLE = {
  productor: { include: { usuario: { select: { nombre: true, apellido: true } } } },
  aplicaciones: {
    include: {
      ordenCompra: { include: { adjudicacion: { include: { campana: { include: { producto: true } } } } } }
    }
  },
  medios: true,
  registradoPor: { select: { nombre: true, apellido: true } }
};

function sumar(items, campo) {
  return items.reduce((acc, i) => acc + Number(i[campo]), 0);
}

/**
 * El productor declara el pago aplicándolo a 1+ órdenes propias, compuesto
 * por 1+ medios de pago. Queda DECLARADO: no toca OrdenCompra.estadoPago
 * todavía (eso pasa recién al confirmar).
 */
export async function crear(datos, usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) throw new ForbiddenError('Usuario no es productor');

  const montoAplicaciones = sumar(datos.aplicaciones, 'montoAplicado');
  const montoMedios = sumar(datos.medios, 'monto');
  if (Math.abs(montoAplicaciones - montoMedios) > 0.01) {
    throw new ValidationError('La suma de los medios de pago no coincide con la suma aplicada a las órdenes');
  }

  const ordenIds = datos.aplicaciones.map((a) => a.ordenCompraId);
  const ordenes = await prisma.ordenCompra.findMany({ where: { id: { in: ordenIds } } });
  if (ordenes.length !== ordenIds.length) throw new NotFoundError('Orden de compra');
  if (ordenes.some((o) => o.productorId !== productor.id)) {
    throw new ForbiddenError('Una de las órdenes no te pertenece');
  }

  // Nada impedía declarar un monto mayor al saldo real de la orden (p. ej. ya
  // tiene pagos CONFIRMADOS previos, o directamente supera el total). Se
  // valida acá antes de crear nada.
  const montoConfirmado = await montoConfirmadoPorOrden(ordenIds);
  for (const aplicacion of datos.aplicaciones) {
    const orden = ordenes.find((o) => o.id === aplicacion.ordenCompraId);
    const pendiente = Number(orden.total) - (montoConfirmado.get(orden.id) ?? 0);
    if (aplicacion.montoAplicado > pendiente + 0.01) {
      throw new ValidationError(`El monto aplicado a la orden #${orden.id} ($${aplicacion.montoAplicado.toFixed(2)}) supera el saldo pendiente ($${pendiente.toFixed(2)})`);
    }
  }

  const pago = await prisma.pago.create({
    data: {
      productorId: productor.id,
      fecha: datos.fecha ?? new Date(),
      montoTotal: montoAplicaciones,
      observaciones: datos.observaciones,
      registradoPorId: usuarioId,
      aplicaciones: {
        create: datos.aplicaciones.map((a) => ({ ordenCompraId: a.ordenCompraId, montoAplicado: a.montoAplicado }))
      },
      medios: { create: datos.medios.map((m) => ({ formaPago: m.formaPago, monto: m.monto })) }
    },
    include: INCLUDE_DETALLE
  });

  eventBus.emit('PAGO_DECLARADO', { pagoId: pago.id, productorId: productor.id, montoTotal: montoAplicaciones });

  return pago;
}

export async function listarMios(usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) throw new ForbiddenError('Usuario no es productor');

  return prisma.pago.findMany({
    where: { productorId: productor.id },
    include: INCLUDE_DETALLE,
    orderBy: { fecha: 'desc' }
  });
}

export async function listar({ estado, page = 1, limit = 20 }) {
  const where = {};
  if (estado) where.estado = estado;

  const [data, total] = await Promise.all([
    prisma.pago.findMany({
      where,
      include: INCLUDE_DETALLE,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { fecha: 'desc' }
    }),
    prisma.pago.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id, usuario) {
  const pago = await prisma.pago.findUnique({ where: { id }, include: INCLUDE_DETALLE });
  if (!pago) throw new NotFoundError('Pago');

  if (usuario.rol === 'PRODUCTOR') {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: usuario.id } });
    if (!productor || pago.productorId !== productor.id) throw new ForbiddenError();
  }

  return pago;
}

/**
 * Confirma que AUT vio la plata acreditada. Recién acá impacta
 * OrdenCompra.estadoPago, sumando TODOS los pagos ya CONFIRMADOS de cada
 * orden (puede haber más de un pago parcial sobre la misma orden).
 */
export async function confirmar(id) {
  const pago = await prisma.pago.findUnique({ where: { id }, include: { aplicaciones: true } });
  if (!pago) throw new NotFoundError('Pago');
  if (pago.estado !== 'DECLARADO') throw new ConflictError(`No se puede confirmar un pago en estado ${pago.estado}`);

  await prisma.$transaction(async (tx) => {
    await tx.pago.update({ where: { id }, data: { estado: 'CONFIRMADO', confirmadoAt: new Date() } });

    for (const aplicacion of pago.aplicaciones) {
      const orden = await tx.ordenCompra.findUnique({ where: { id: aplicacion.ordenCompraId } });

      const confirmadas = await tx.pagoAplicacion.aggregate({
        where: { ordenCompraId: aplicacion.ordenCompraId, pago: { estado: 'CONFIRMADO' } },
        _sum: { montoAplicado: true }
      });
      const montoConfirmado = Number(confirmadas._sum.montoAplicado ?? 0);

      const estadoPago = montoConfirmado >= Number(orden.total) - 0.01
        ? 'PAGADO'
        : montoConfirmado > 0
          ? 'PARCIAL'
          : orden.estadoPago;

      await tx.ordenCompra.update({ where: { id: aplicacion.ordenCompraId }, data: { estadoPago } });
    }
  });

  eventBus.emit('PAGO_CONFIRMADO', { pagoId: id, productorId: pago.productorId, montoTotal: Number(pago.montoTotal) });

  return prisma.pago.findUnique({ where: { id }, include: INCLUDE_DETALLE });
}

export async function rechazar(id, motivo) {
  const pago = await prisma.pago.findUnique({ where: { id } });
  if (!pago) throw new NotFoundError('Pago');
  if (pago.estado !== 'DECLARADO') throw new ConflictError(`No se puede rechazar un pago en estado ${pago.estado}`);

  const actualizado = await prisma.pago.update({
    where: { id },
    data: { estado: 'RECHAZADO', observaciones: motivo },
    include: INCLUDE_DETALLE
  });

  eventBus.emit('PAGO_RECHAZADO', { pagoId: id, productorId: pago.productorId, motivo });

  return actualizado;
}
