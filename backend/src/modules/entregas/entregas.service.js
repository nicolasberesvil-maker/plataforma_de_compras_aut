import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';
import { puedeTransicionar } from '../../utils/transiciones-entrega.js';

const INCLUDE_DETALLE = {
  ordenCompra: {
    include: { adjudicacion: { include: { campana: { include: { producto: true } } } } }
  },
  productor: { include: { usuario: { select: { nombre: true, apellido: true, telefono: true } } } },
  deposito: true
};

export async function listarMias(usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) throw new ForbiddenError();

  return prisma.entrega.findMany({
    where: { productorId: productor.id },
    include: INCLUDE_DETALLE,
    orderBy: { createdAt: 'desc' }
  });
}

/** Entregas de las ventas del proveedor (para que confirme entregas en campo). */
export async function listarMiasProveedor(usuarioId) {
  const proveedor = await prisma.proveedor.findUnique({ where: { usuarioId } });
  if (!proveedor) throw new ForbiddenError();

  return prisma.entrega.findMany({
    where: { ordenCompra: { adjudicacion: { cotizacionGanadora: { proveedorId: proveedor.id } } } },
    include: INCLUDE_DETALLE,
    orderBy: { createdAt: 'desc' }
  });
}

export async function listar({ depositoId, estado, page = 1, limit = 20 }) {
  const where = {};
  if (depositoId) where.depositoId = depositoId;
  if (estado) where.estado = estado;

  const [data, total] = await Promise.all([
    prisma.entrega.findMany({
      where,
      include: INCLUDE_DETALLE,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.entrega.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id, usuario) {
  const entrega = await prisma.entrega.findUnique({ where: { id }, include: INCLUDE_DETALLE });
  if (!entrega) throw new NotFoundError('Entrega');

  if (usuario.rol === 'PRODUCTOR') {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: usuario.id } });
    if (!productor || entrega.productorId !== productor.id) throw new ForbiddenError();
  } else if (!['ADMIN', 'OPERADOR_DEPOSITO'].includes(usuario.rol)) {
    // Sin esto, cualquier rol autenticado (PROVEEDOR...) podía ver el detalle
    // de la entrega de cualquier productor (nombre, DNI de quien retiró,
    // depósito). El check de PRODUCTOR de arriba solo cubre ese rol.
    throw new ForbiddenError();
  }

  return entrega;
}

export async function marcarEnTransito(id, datos = {}, usuario) {
  const entrega = await obtenerEntregaConValidacion(id, 'EN_TRANSITO');

  if (usuario?.rol === 'PROVEEDOR') {
    await verificarOwnershipProveedor(id, usuario);
  }

  const actualizada = await prisma.entrega.update({
    where: { id },
    data: {
      estado: 'EN_TRANSITO',
      // El depósito destino puede definirse recién acá si todavía no estaba
      // asignado (Fase 7 crea la Entrega sin depositoId).
      ...(datos.depositoId ? { depositoId: datos.depositoId } : {})
    },
    include: INCLUDE_DETALLE
  });

  eventBus.emit('ENTREGA_EN_TRANSITO', {
    entregaId: id,
    productorId: entrega.productorId
  });

  return actualizada;
}

export async function marcarDisponible(id, datos = {}) {
  const entrega = await obtenerEntregaConValidacion(id, 'DISPONIBLE_PARA_RETIRO');

  if (entrega.modalidad !== 'RETIRO_EN_DEPOSITO') {
    throw new ValidationError('Solo aplicable a entregas de tipo RETIRO_EN_DEPOSITO');
  }

  const depositoId = datos.depositoId ?? entrega.depositoId;
  if (!depositoId) {
    throw new ValidationError('La entrega no tiene depósito asignado. Indicá depositoId.');
  }

  const actualizada = await prisma.entrega.update({
    where: { id },
    data: {
      estado: 'DISPONIBLE_PARA_RETIRO',
      depositoId,
      fechaDisponibleDesde: new Date()
    },
    include: INCLUDE_DETALLE
  });

  // Esta es la notif más importante: el productor recibe email + campanita
  eventBus.emit('ENTREGA_DISPONIBLE', {
    entregaId: id,
    productorId: entrega.productorId,
    depositoId
  });

  return actualizada;
}

/**
 * Confirma retiro físico por productor (lo registra el operador del depósito).
 * Atomic: cambia estado + genera movimiento de stock egreso.
 */
export async function confirmarRetiro(id, datos, usuarioId) {
  const actualizada = await prisma.$transaction(async (tx) => {
    const entrega = await tx.entrega.findUnique({
      where: { id },
      include: {
        ordenCompra: {
          include: { adjudicacion: { include: { campana: { include: { producto: true } } } } }
        }
      }
    });
    if (!entrega) throw new NotFoundError('Entrega');
    if (entrega.modalidad !== 'RETIRO_EN_DEPOSITO') {
      throw new ValidationError('No es entrega tipo retiro');
    }
    // Chequeo específico (no genérico vía puedeTransicionar): la tabla de
    // transiciones permite EN_TRANSITO -> ENTREGADA para soportar la
    // confirmación directa de entregas en campo, pero un retiro en depósito
    // SIEMPRE tiene que pasar por DISPONIBLE_PARA_RETIRO (es el paso que le
    // avisa al productor que ya puede venir a buscarlo).
    if (entrega.estado !== 'DISPONIBLE_PARA_RETIRO') {
      throw new ConflictError(`No se puede confirmar el retiro desde el estado ${entrega.estado}`);
    }
    if (!entrega.depositoId) {
      throw new ValidationError('La entrega no tiene depósito asignado');
    }

    const entregaActualizada = await tx.entrega.update({
      where: { id },
      data: {
        estado: 'ENTREGADA',
        fechaEntregadaAt: new Date(),
        recibidaPorNombre: datos.recibidaPorNombre,
        recibidaPorDni: datos.recibidaPorDni,
        observaciones: datos.observaciones
      }
    });

    await tx.stockMovimiento.create({
      data: {
        depositoId: entrega.depositoId,
        productoId: entrega.ordenCompra.adjudicacion.campana.productoId,
        tipo: 'EGRESO_PRODUCTOR',
        cantidad: entrega.ordenCompra.volumenFinal,
        signo: -1,
        entregaId: id,
        ejecutadoPorId: usuarioId,
        observaciones: `Retiro confirmado por ${datos.recibidaPorNombre}`
      }
    });

    return entregaActualizada;
  });

  eventBus.emit('ENTREGA_CONFIRMADA', {
    entregaId: id,
    productorId: actualizada.productorId
  });

  return prisma.entrega.findUnique({ where: { id }, include: INCLUDE_DETALLE });
}

/**
 * Confirma entrega en campo. La ejecuta el ADMIN, el OPERADOR_DEPOSITO o el
 * PROVEEDOR dueño de la venta — no el productor: quien entrega es quien
 * confirma que entregó (regla revisada, ver EntregaCard.jsx).
 */
export async function confirmarEntregaCampo(id, datos, usuario) {
  const entrega = await obtenerEntregaConValidacion(id, 'ENTREGADA');

  if (entrega.modalidad !== 'ENTREGA_EN_CAMPO') {
    throw new ValidationError('No es entrega tipo campo');
  }

  if (usuario.rol === 'PROVEEDOR') {
    await verificarOwnershipProveedor(id, usuario);
  }

  const actualizada = await prisma.entrega.update({
    where: { id },
    data: {
      estado: 'ENTREGADA',
      fechaEntregadaAt: new Date(),
      recibidaPorNombre: datos.recibidaPorNombre,
      recibidaPorDni: datos.recibidaPorDni,
      observaciones: datos.observaciones
    },
    include: INCLUDE_DETALLE
  });

  eventBus.emit('ENTREGA_CONFIRMADA', {
    entregaId: id,
    productorId: actualizada.productorId
  });

  return actualizada;
}

export async function cancelar(id, motivo) {
  const entrega = await prisma.entrega.findUnique({ where: { id } });
  if (!entrega) throw new NotFoundError('Entrega');
  if (entrega.estado === 'ENTREGADA') throw new ConflictError('Ya fue entregada');
  if (entrega.estado === 'CANCELADA') throw new ConflictError('Ya está cancelada');

  return prisma.entrega.update({
    where: { id },
    data: { estado: 'CANCELADA', observaciones: motivo },
    include: INCLUDE_DETALLE
  });
}

// ============================================================

async function obtenerEntregaConValidacion(id, estadoNuevo) {
  const entrega = await prisma.entrega.findUnique({ where: { id } });
  if (!entrega) throw new NotFoundError('Entrega');
  if (!puedeTransicionar(entrega.estado, estadoNuevo)) {
    throw new ConflictError(`No se puede pasar de ${entrega.estado} a ${estadoNuevo}`);
  }
  return entrega;
}

/** El proveedor solo puede accionar entregas de ventas de sus propias cotizaciones ganadoras. */
async function verificarOwnershipProveedor(entregaId, usuario) {
  const proveedor = await prisma.proveedor.findUnique({ where: { usuarioId: usuario.id } });
  if (!proveedor) throw new ForbiddenError();

  const entrega = await prisma.entrega.findUnique({
    where: { id: entregaId },
    include: { ordenCompra: { include: { adjudicacion: { include: { cotizacionGanadora: true } } } } }
  });
  if (!entrega || entrega.ordenCompra.adjudicacion.cotizacionGanadora.proveedorId !== proveedor.id) {
    throw new ForbiddenError('Solo el proveedor dueño de la venta puede confirmarla');
  }
}
