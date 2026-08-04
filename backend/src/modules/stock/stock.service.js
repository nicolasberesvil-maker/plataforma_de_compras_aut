import { prisma } from '../../config/database.js';
import { ValidationError } from '../../utils/errors.js';

/**
 * Registra ingreso de mercadería al depósito (típicamente tras llegada de
 * proveedor adjudicado).
 */
export async function registrarIngreso(datos, usuarioId) {
  if (datos.cantidad <= 0) throw new ValidationError('Cantidad debe ser positiva');

  return prisma.stockMovimiento.create({
    data: {
      depositoId: datos.depositoId,
      productoId: datos.productoId,
      tipo: 'INGRESO_PROVEEDOR',
      cantidad: datos.cantidad,
      signo: 1,
      proveedorOrigen: datos.proveedorOrigen,
      numeroRemito: datos.numeroRemito,
      observaciones: datos.observaciones,
      ejecutadoPorId: usuarioId
    }
  });
}

/**
 * Egreso manual a un productor, fuera del flujo formal de Entrega (por
 * ejemplo, mercadería que se le entregó por su cuenta sin pasar por una
 * OrdenCompra). No valida stock disponible, igual que ajustes y
 * transferencias (regla ya existente en este módulo).
 */
export async function registrarEgresoManual(datos, usuarioId) {
  if (datos.cantidad <= 0) throw new ValidationError('Cantidad debe ser positiva');

  return prisma.stockMovimiento.create({
    data: {
      depositoId: datos.depositoId,
      productoId: datos.productoId,
      productorId: datos.productorId,
      tipo: 'EGRESO_PRODUCTOR',
      cantidad: datos.cantidad,
      signo: -1,
      observaciones: datos.observaciones,
      ejecutadoPorId: usuarioId
    }
  });
}

/**
 * Registra ajuste por conteo físico. diferencia puede ser positiva (más
 * stock real) o negativa (menos).
 */
export async function registrarAjuste(datos, usuarioId) {
  const { depositoId, productoId, diferencia, observaciones } = datos;

  if (diferencia === 0) throw new ValidationError('La diferencia no puede ser 0');
  if (!observaciones || observaciones.length < 10) {
    throw new ValidationError('El ajuste requiere observaciones (≥ 10 caracteres)');
  }

  const tipo = diferencia > 0 ? 'AJUSTE_INVENTARIO_POSITIVO' : 'AJUSTE_INVENTARIO_NEGATIVO';
  const signo = diferencia > 0 ? 1 : -1;

  return prisma.stockMovimiento.create({
    data: {
      depositoId,
      productoId,
      tipo,
      cantidad: Math.abs(diferencia),
      signo,
      observaciones,
      ejecutadoPorId: usuarioId
    }
  });
}

/**
 * Transferencia entre depósitos: genera DOS movimientos en una transacción.
 */
export async function registrarTransferencia(datos, usuarioId) {
  const { depositoOrigenId, depositoDestinoId, productoId, cantidad, observaciones } = datos;

  if (depositoOrigenId === depositoDestinoId) {
    throw new ValidationError('Origen y destino no pueden ser iguales');
  }
  if (cantidad <= 0) throw new ValidationError('Cantidad debe ser positiva');

  return prisma.$transaction(async (tx) => {
    const salida = await tx.stockMovimiento.create({
      data: {
        depositoId: depositoOrigenId,
        productoId,
        tipo: 'TRANSFERENCIA_SALIDA',
        cantidad,
        signo: -1,
        observaciones: `Transferencia a depósito ${depositoDestinoId}. ${observaciones || ''}`,
        ejecutadoPorId: usuarioId
      }
    });

    const entrada = await tx.stockMovimiento.create({
      data: {
        depositoId: depositoDestinoId,
        productoId,
        tipo: 'TRANSFERENCIA_ENTRADA',
        cantidad,
        signo: 1,
        observaciones: `Transferencia desde depósito ${depositoOrigenId}. ${observaciones || ''}`,
        ejecutadoPorId: usuarioId
      }
    });

    return { salida, entrada };
  });
}

/**
 * Egreso por retiro de productor. Llamado por el módulo Entregas (Fase 9)
 * cuando se confirma retiro.
 */
export async function registrarEgresoProductor({ depositoId, productoId, cantidad, entregaId }, usuarioId) {
  return prisma.stockMovimiento.create({
    data: {
      depositoId,
      productoId,
      tipo: 'EGRESO_PRODUCTOR',
      cantidad,
      signo: -1,
      entregaId,
      ejecutadoPorId: usuarioId
    }
  });
}

export async function listarMovimientos({ depositoId, productoId, desde, hasta, page = 1, limit = 50 }) {
  const where = {};
  if (depositoId) where.depositoId = depositoId;
  if (productoId) where.productoId = productoId;
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = new Date(desde);
    if (hasta) where.fecha.lte = new Date(hasta);
  }

  const [data, total] = await Promise.all([
    prisma.stockMovimiento.findMany({
      where,
      include: {
        deposito: { select: { nombre: true, localidad: true } },
        producto: { select: { nombre: true, unidadMedida: true } },
        ejecutadoPor: { select: { nombre: true, apellido: true } },
        entrega: { select: { ordenCompraId: true } },
        productor: { select: { razonSocial: true } }
      },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { fecha: 'desc' }
    }),
    prisma.stockMovimiento.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
