import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';
import { socketService } from '../../services/socket.service.js';

export async function listarMias(usuarioId) {
  const productor = await obtenerProductorDelUsuario(usuarioId);
  return prisma.intencionCompra.findMany({
    where: { productorId: productor.id },
    include: { campana: true, producto: true },
    orderBy: { createdAt: 'desc' }
  });
}

/** Bandeja ADMIN: pedidos sueltos y/o dentro de campañas, filtrable por estado/producto. */
export async function listar({ estado, productoId, soloSueltas, page = 1, limit = 20 }) {
  const where = {};
  if (estado) where.estado = estado;
  if (productoId) where.productoId = productoId;
  if (soloSueltas) where.campanaId = null;

  const [data, total] = await Promise.all([
    prisma.intencionCompra.findMany({
      where,
      include: { producto: true, productor: { include: { usuario: true } }, campana: true },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'asc' }
    }),
    prisma.intencionCompra.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id, usuario) {
  const intencion = await prisma.intencionCompra.findUnique({
    where: { id },
    include: { campana: { include: { producto: true } }, producto: true, productor: true }
  });
  if (!intencion) throw new NotFoundError('Intención');

  if (usuario.rol === 'PRODUCTOR') {
    const productor = await obtenerProductorDelUsuario(usuario.id);
    if (intencion.productorId !== productor.id) throw new ForbiddenError();
  }

  return intencion;
}

/**
 * Crea una intención. Si `datos.campanaId` viene seteado es el camino
 * top-down (dentro de una campaña ABIERTA); si no, es un pedido suelto
 * bottom-up (regla D.1) que queda PENDIENTE de revisión del ADMIN.
 */
export async function crear(datos, usuarioId) {
  const productor = await obtenerProductorDelUsuario(usuarioId);

  if (!datos.campanaId) {
    return crearSuelta(datos, productor);
  }

  const campana = await prisma.campana.findUnique({ where: { id: datos.campanaId } });
  if (!campana) throw new NotFoundError('Campaña');
  if (campana.estado !== 'ABIERTA') throw new ConflictError('La campaña no está abierta');
  validarLockout(campana);

  if (campana.volumenMaximo) {
    const stats = await prisma.intencionCompra.aggregate({
      where: { campanaId: campana.id },
      _sum: { volumen: true }
    });
    const acumulado = Number(stats._sum.volumen ?? 0);
    if (acumulado + datos.volumen > Number(campana.volumenMaximo)) {
      throw new ValidationError('Se superaría el volumen máximo de la campaña');
    }
  }

  const existente = await prisma.intencionCompra.findUnique({
    where: { campanaId_productorId: { campanaId: campana.id, productorId: productor.id } }
  });
  if (existente) {
    throw new ConflictError('Ya cargaste una intención. Editala en vez de crear una nueva.');
  }

  const intencion = await prisma.intencionCompra.create({
    data: {
      campanaId: campana.id,
      productorId: productor.id,
      productoId: campana.productoId,
      volumen: datos.volumen,
      observaciones: datos.observaciones,
      fechaDeseada: datos.fechaDeseada,
      modalidadEntregaPreferida: datos.modalidadEntregaPreferida,
      direccionEntregaCampo: datos.direccionEntregaCampo,
      formasPagoPreferidas: datos.formasPagoPreferidas
    },
    include: { campana: { include: { producto: true } } }
  });

  eventBus.emit('INTENCION_CARGADA', {
    intencionId: intencion.id,
    campanaId: campana.id,
    productorId: productor.id,
    volumen: Number(intencion.volumen)
  });

  await notificarActualizacionCampana(campana.id);

  return intencion;
}

async function crearSuelta(datos, productor) {
  const producto = await prisma.producto.findUnique({ where: { id: datos.productoId } });
  if (!producto) throw new NotFoundError('Producto');

  const intencion = await prisma.intencionCompra.create({
    data: {
      productorId: productor.id,
      productoId: producto.id,
      volumen: datos.volumen,
      observaciones: datos.observaciones,
      fechaDeseada: datos.fechaDeseada,
      modalidadEntregaPreferida: datos.modalidadEntregaPreferida,
      direccionEntregaCampo: datos.direccionEntregaCampo,
      formasPagoPreferidas: datos.formasPagoPreferidas
    },
    include: { producto: true }
  });

  // Avisa al equipo de AUT, no a otros productores: todavía no existe ningún
  // requerimiento público sobre este pedido.
  eventBus.emit('SOLICITUD_RECIBIDA', {
    intencionId: intencion.id,
    productoId: producto.id,
    productorId: productor.id
  });

  return intencion;
}

export async function actualizar(id, datos, usuarioId) {
  const intencion = await prisma.intencionCompra.findUnique({
    where: { id },
    include: { campana: true }
  });
  if (!intencion) throw new NotFoundError('Intención');

  const productor = await obtenerProductorDelUsuario(usuarioId);
  if (intencion.productorId !== productor.id) throw new ForbiddenError();

  if (intencion.campanaId) {
    if (intencion.campana.estado !== 'ABIERTA') throw new ConflictError('La campaña ya no está abierta');
    validarLockout(intencion.campana);
  } else if (intencion.estado !== 'PENDIENTE') {
    throw new ConflictError('Solo se puede editar un pedido PENDIENTE');
  }

  const actualizada = await prisma.intencionCompra.update({
    where: { id },
    data: {
      volumen: datos.volumen,
      observaciones: datos.observaciones,
      fechaDeseada: datos.fechaDeseada,
      modalidadEntregaPreferida: datos.modalidadEntregaPreferida,
      direccionEntregaCampo: datos.direccionEntregaCampo,
      formasPagoPreferidas: datos.formasPagoPreferidas
    },
    include: { campana: { include: { producto: true } }, producto: true }
  });

  if (intencion.campanaId) await notificarActualizacionCampana(intencion.campanaId);
  return actualizada;
}

export async function eliminar(id, usuarioId) {
  const intencion = await prisma.intencionCompra.findUnique({ where: { id }, include: { campana: true } });
  if (!intencion) throw new NotFoundError('Intención');

  const productor = await obtenerProductorDelUsuario(usuarioId);
  if (intencion.productorId !== productor.id) throw new ForbiddenError();

  if (intencion.campanaId) {
    if (intencion.campana.estado !== 'ABIERTA') throw new ConflictError('La campaña ya no está abierta');
    validarLockout(intencion.campana);
  } else if (intencion.estado !== 'PENDIENTE') {
    throw new ConflictError('Solo se puede retirar un pedido PENDIENTE');
  }

  await prisma.intencionCompra.delete({ where: { id } });
  if (intencion.campanaId) await notificarActualizacionCampana(intencion.campanaId);
}

/** ADMIN descarta un pedido suelto que no amerita armar un requerimiento. */
export async function descartar(id, motivo) {
  const intencion = await prisma.intencionCompra.findUnique({ where: { id } });
  if (!intencion) throw new NotFoundError('Intención');
  if (intencion.campanaId) throw new ConflictError('Solo se descartan pedidos sueltos');
  if (intencion.estado !== 'PENDIENTE') throw new ConflictError('El pedido ya fue procesado');

  const actualizada = await prisma.intencionCompra.update({
    where: { id },
    data: { estado: 'DESCARTADA', motivoDescarte: motivo }
  });

  eventBus.emit('SOLICITUD_DESCARTADA', { intencionId: id, productorId: intencion.productorId, motivo });
  return actualizada;
}

/**
 * EL CORAZÓN DEL CAMINO BOTTOM-UP: agrupa N pedidos sueltos en una o más
 * Campana COLECTIVA nuevas. Si los pedidos seleccionados son de más de un
 * producto distinto, primero se crea un Lote (agrupador organizacional/
 * visual, sin ciclo de vida propio) y se crea una Campana por producto,
 * todas ligadas a ese Lote — adjudicación, orden, entrega, factura y pago
 * siguen siendo estrictamente por producto/Campana, el Lote no participa en
 * nada de eso. Todo en una transacción: si falla a mitad de camino no
 * queremos pedidos marcados AGRUPADA sin una campaña real detrás (regla de
 * oro de transacciones Prisma).
 */
export async function agrupar(datos, usuario) {
  const { intencionIds, nombre, fechaCierre, fechaEstimadaRecepcion, horasLockoutEdicion, volumenesPorProducto = [] } = datos;

  const resultado = await prisma.$transaction(async (tx) => {
    const intenciones = await tx.intencionCompra.findMany({
      where: { id: { in: intencionIds }, campanaId: null, estado: 'PENDIENTE' },
      include: { producto: true }
    });
    if (intenciones.length !== intencionIds.length) {
      throw new ValidationError('Algún pedido no existe, ya tiene campaña o no está PENDIENTE');
    }

    const productoIds = [...new Set(intenciones.map((i) => i.productoId))];
    const esLote = productoIds.length > 1;
    const lote = esLote
      ? await tx.lote.create({ data: { nombre, creadaPorId: usuario.id } })
      : null;

    const campanas = [];
    for (const productoId of productoIds) {
      const producto = intenciones.find((i) => i.productoId === productoId).producto;
      const vol = volumenesPorProducto.find((v) => v.productoId === productoId);

      const campana = await tx.campana.create({
        data: {
          productoId,
          loteId: lote?.id ?? null,
          tipo: 'COLECTIVA',
          nombre: esLote ? `${nombre} — ${producto.nombre}` : nombre,
          volumenMinimo: vol?.volumenMinimo ?? null,
          volumenMaximo: vol?.volumenMaximo ?? null,
          fechaApertura: new Date(),
          fechaCierre,
          fechaEstimadaRecepcion: fechaEstimadaRecepcion ?? null,
          horasLockoutEdicion: horasLockoutEdicion ?? 0,
          estado: 'ABIERTA', // nace ABIERTA: los pedidos sueltos YA son voluntad de compra
          creadaPorId: usuario.id
        }
      });
      campanas.push(campana);

      await tx.intencionCompra.updateMany({
        where: { id: { in: intenciones.filter((i) => i.productoId === productoId).map((i) => i.id) } },
        data: { campanaId: campana.id, estado: 'AGRUPADA' }
      });
    }

    return { lote, campanas, intenciones };
  });

  for (const campana of resultado.campanas) {
    eventBus.emit('CAMPANA_ABIERTA', { campanaId: campana.id, productoId: campana.productoId });
  }
  for (const intencion of resultado.intenciones) {
    const campana = resultado.campanas.find((c) => c.productoId === intencion.productoId);
    eventBus.emit('SOLICITUD_AGRUPADA', {
      intencionId: intencion.id,
      productorId: intencion.productorId,
      campanaId: campana.id
    });
  }

  return { lote: resultado.lote, campanas: resultado.campanas };
}

/**
 * Tablero agregado por producto: para cada producto, cuánto suma entre
 * pedidos sueltos PENDIENTES de agrupar y lo que ya está cargado en campañas
 * propias todavía sin cerrar (BORRADOR/ABIERTA). Le da al ADMIN, en una sola
 * pantalla, el volumen total antes de decidir armar una cotización.
 */
export async function obtenerTablero() {
  const [sueltas, enCampanas] = await Promise.all([
    prisma.intencionCompra.groupBy({
      by: ['productoId'],
      where: { campanaId: null, estado: 'PENDIENTE' },
      _sum: { volumen: true },
      _count: true
    }),
    prisma.intencionCompra.groupBy({
      by: ['productoId'],
      where: { campana: { estado: { in: ['BORRADOR', 'ABIERTA'] } } },
      _sum: { volumen: true },
      _count: true
    })
  ]);

  const productoIds = [...new Set([...sueltas.map((s) => s.productoId), ...enCampanas.map((c) => c.productoId)])];
  const productos = await prisma.producto.findMany({ where: { id: { in: productoIds } } });

  return productoIds
    .map((productoId) => {
      const s = sueltas.find((x) => x.productoId === productoId);
      const c = enCampanas.find((x) => x.productoId === productoId);
      const producto = productos.find((p) => p.id === productoId);
      const totalSueltoPendiente = Number(s?._sum.volumen ?? 0);
      const totalEnCampanasPropias = Number(c?._sum.volumen ?? 0);

      return {
        productoId,
        producto: producto?.nombre,
        unidadMedida: producto?.unidadMedida,
        totalSueltoPendiente,
        cantidadPedidosSueltos: s?._count ?? 0,
        totalEnCampanasPropias,
        cantidadEnCampanasPropias: c?._count ?? 0,
        totalGeneral: totalSueltoPendiente + totalEnCampanasPropias
      };
    })
    .sort((a, b) => b.totalGeneral - a.totalGeneral);
}

// ============================================================
// Helpers
// ============================================================

async function obtenerProductorDelUsuario(usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) throw new ForbiddenError('Usuario no es productor');
  return productor;
}

function validarLockout(campana) {
  if (campana.horasLockoutEdicion === 0) return;

  const lockout = new Date(campana.fechaCierre);
  lockout.setHours(lockout.getHours() - campana.horasLockoutEdicion);

  if (new Date() >= lockout) {
    throw new ConflictError(`La edición está bloqueada (${campana.horasLockoutEdicion} hs antes del cierre)`);
  }
}

async function notificarActualizacionCampana(campanaId) {
  const stats = await prisma.intencionCompra.aggregate({
    where: { campanaId },
    _sum: { volumen: true },
    _count: true
  });

  socketService.emitirAlaCampana(campanaId, 'campana:actualizada', {
    campanaId,
    volumenAcumulado: Number(stats._sum.volumen ?? 0),
    cantidadProductores: stats._count
  });
}
