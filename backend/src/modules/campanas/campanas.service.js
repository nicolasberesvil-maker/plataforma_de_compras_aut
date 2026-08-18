import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';
import { puedeTransicionar } from '../../utils/transiciones-campana.js';

export async function listar({ estado, tipo, productoId, loteId, vista, page = 1, limit = 20 }) {
  const where = {};
  if (vista === 'agrupadas') where.estado = { in: ['ABIERTA', 'EN_LICITACION', 'ADJUDICADA'] };
  else if (vista === 'concretadas') where.estado = 'CERRADA';
  else if (vista === 'abiertas') where.estado = 'ABIERTA';
  else if (vista === 'en-licitacion') where.estado = 'EN_LICITACION';
  else if (vista === 'ordenes') where.estado = { in: ['ADJUDICADA', 'CERRADA'] };
  else if (estado) where.estado = estado;
  if (tipo) where.tipo = tipo;
  if (productoId) where.productoId = productoId;
  if (loteId) where.loteId = loteId;

  const [data, total] = await Promise.all([
    prisma.campana.findMany({
      where,
      include: {
        producto: true,
        lote: true,
        _count: { select: { cotizaciones: true } },
        adjudicacion: { select: { adjudicadaAt: true, cotizacionGanadora: { select: { createdAt: true } } } }
      },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.campana.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id) {
  const campana = await prisma.campana.findUnique({
    where: { id },
    include: {
      producto: true,
      lote: true,
      creadaPor: { select: { nombre: true, apellido: true } },
      _count: { select: { cotizaciones: true } }
    }
  });
  if (!campana) throw new NotFoundError('Campaña');
  return campana;
}

/**
 * Vista resumida para mostrar al productor.
 * Incluye volumen acumulado y cantidad de productores, sin nombres (regla C.6).
 * Si el usuario es productor, incluye su propia intención.
 */
export async function obtenerResumen(id, usuario) {
  const campana = await obtenerPorId(id);

  const stats = await prisma.intencionCompra.aggregate({
    where: { campanaId: id },
    _sum: { volumen: true },
    _count: true
  });

  const resumen = {
    id: campana.id,
    nombre: campana.nombre,
    descripcion: campana.descripcion,
    tipo: campana.tipo,
    estado: campana.estado,
    producto: campana.producto,
    volumenAcumulado: Number(stats._sum.volumen ?? 0),
    volumenMinimo: campana.volumenMinimo ? Number(campana.volumenMinimo) : null,
    cantidadProductores: stats._count,
    fechaApertura: campana.fechaApertura,
    fechaCierre: campana.fechaCierre,
    fechaEstimadaRecepcion: campana.fechaEstimadaRecepcion,
    horasLockoutEdicion: campana.horasLockoutEdicion
  };

  // Forma de pago que definió el proveedor ganador: solo una vez adjudicada.
  // No se expone identidad del proveedor (regla C.6, sobre cerrado).
  if (['ADJUDICADA', 'CERRADA'].includes(campana.estado)) {
    const adjudicacion = await prisma.adjudicacion.findUnique({
      where: { campanaId: id },
      include: { cotizacionGanadora: { select: { condicionesPago: true, plazoEntregaDias: true } } }
    });
    if (adjudicacion) {
      resumen.condicionesPagoGanadora = adjudicacion.cotizacionGanadora.condicionesPago;
      resumen.plazoEntregaDiasGanador = adjudicacion.cotizacionGanadora.plazoEntregaDias;
    }
  }

  if (usuario.rol === 'PRODUCTOR') {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: usuario.id } });
    if (productor) {
      const miIntencion = await prisma.intencionCompra.findUnique({
        where: { campanaId_productorId: { campanaId: id, productorId: productor.id } }
      });
      resumen.miIntencionPropia = miIntencion;
    }
  }

  return resumen;
}

export async function crear(datos, usuario) {
  const tipo = datos.tipo ?? 'COLECTIVA';

  // Validaciones de negocio que dependen del tipo.
  // COLECTIVA es la más exigente: necesita volumen mínimo y ventana de cierre.
  if (tipo === 'COLECTIVA') {
    if (!datos.volumenMinimo || Number(datos.volumenMinimo) <= 0) {
      throw new ValidationError('Una compra COLECTIVA requiere volumen mínimo positivo');
    }
    if (!datos.fechaCierre) {
      throw new ValidationError('Una compra COLECTIVA requiere fecha de cierre');
    }
    if (new Date(datos.fechaCierre) <= new Date(datos.fechaApertura)) {
      throw new ValidationError('La fecha de cierre debe ser posterior a la de apertura');
    }
  }

  // CONTINUA no cierra por fecha: se ignora la que haya venido cargada.
  if (tipo === 'CONTINUA' && datos.fechaCierre) {
    datos.fechaCierre = null;
  }

  // Regla común: máximo ≥ mínimo cuando ambos existen.
  if (datos.volumenMaximo && datos.volumenMinimo && datos.volumenMaximo < datos.volumenMinimo) {
    throw new ValidationError('Volumen máximo debe ser ≥ volumen mínimo');
  }

  const campana = await prisma.campana.create({
    data: {
      ...datos,
      tipo,
      estado: 'BORRADOR',
      creadaPorId: usuario.id
    },
    include: { producto: true }
  });

  eventBus.emit('CAMPANA_CREADA', { campanaId: campana.id, tipo, creadoPorId: usuario.id });
  return campana;
}

export async function actualizar(id, datos) {
  const campana = await obtenerPorId(id);
  if (campana.estado !== 'BORRADOR') {
    throw new ConflictError('Solo se puede editar una campaña en BORRADOR');
  }
  return prisma.campana.update({ where: { id }, data: datos, include: { producto: true } });
}

/**
 * Transiciona BORRADOR → ABIERTA. Dispara notificación masiva a productores.
 */
export async function abrir(id) {
  const campana = await obtenerPorId(id);
  if (!puedeTransicionar(campana.tipo, campana.estado, 'ABIERTA')) {
    throw new ConflictError(`No se puede pasar de ${campana.estado} a ABIERTA (tipo ${campana.tipo})`);
  }
  // La validación de fecha solo aplica cuando hay fechaCierre (COLECTIVA).
  if (campana.fechaCierre && new Date(campana.fechaCierre) <= new Date()) {
    throw new ValidationError('No se puede abrir: la fecha de cierre ya pasó');
  }

  const actualizada = await prisma.campana.update({
    where: { id },
    data: { estado: 'ABIERTA' }
  });

  eventBus.emit('CAMPANA_ABIERTA', { campanaId: id, productoId: campana.productoId });

  return actualizada;
}

/**
 * Transiciona ABIERTA → EN_LICITACION.
 * Se ejecuta manualmente por AUT o automáticamente por el cron al vencer fechaCierre.
 */
export async function cerrarIntenciones(id, { motivo } = {}) {
  const campana = await obtenerPorId(id);
  // Solo COLECTIVA licita. DIRECTA/CONTINUA no tienen este paso.
  if (!puedeTransicionar(campana.tipo, campana.estado, 'EN_LICITACION')) {
    throw new ConflictError(`No se puede pasar de ${campana.estado} a EN_LICITACION (tipo ${campana.tipo})`);
  }

  // El proveedor tiene que cotizar sabiendo con qué condiciones va a pactar
  // la compra: sin esto no hay forma de comunicárselo (regla nueva, antes
  // estos campos eran opcionales y nunca se validaban).
  const faltantes = [];
  if (!campana.fechaEstimadaRecepcion) faltantes.push('fecha estimada de recepción');
  if (!campana.volumenMaximo) faltantes.push('volumen máximo');
  if (!campana.modalidadesEntregaOfrecidas) faltantes.push('modalidad(es) de entrega ofrecida(s)');
  if (!campana.formasPagoOfrecidas) faltantes.push('forma(s) de pago aceptadas');
  if (faltantes.length) {
    throw new ValidationError(`Antes de enviar a licitación completá: ${faltantes.join(', ')}`);
  }

  const stats = await prisma.intencionCompra.aggregate({
    where: { campanaId: id },
    _sum: { volumen: true }
  });
  const volumenAcumulado = Number(stats._sum.volumen ?? 0);

  // Nota: si el volumen no llegó al mínimo, se transiciona igual y AUT decide
  // adjudicar o cancelar desde EN_LICITACION. No bloquea la transición.

  const actualizada = await prisma.campana.update({
    where: { id },
    data: { estado: 'EN_LICITACION' }
  });

  eventBus.emit('CAMPANA_CERRADA', { campanaId: id, motivo });
  eventBus.emit('RFQ_ABIERTO', { campanaId: id, volumenConsolidado: volumenAcumulado });

  return actualizada;
}

/**
 * Completa las condiciones que AUT ofrece/exige para esta compra puntual
 * (requisito para poder pasar a EN_LICITACION vía cerrarIntenciones). Solo
 * aplica a campañas ABIERTA: una vez en licitación esas condiciones ya se
 * comunicaron al proveedor y no tiene sentido seguir editándolas acá.
 */
export async function completarRequisitosLicitacion(id, datos) {
  const campana = await obtenerPorId(id);
  if (campana.estado !== 'ABIERTA') {
    throw new ConflictError('Solo se pueden completar los requisitos de licitación de una campaña ABIERTA');
  }

  return prisma.campana.update({
    where: { id },
    data: {
      fechaEstimadaRecepcion: datos.fechaEstimadaRecepcion,
      volumenMaximo: datos.volumenMaximo,
      modalidadesEntregaOfrecidas: datos.modalidadesEntregaOfrecidas,
      formasPagoOfrecidas: datos.formasPagoOfrecidas
    },
    include: { producto: true }
  });
}

/**
 * DIRECTA: adjudica sin licitar. El proveedor y el precio ya los conoce AUT,
 * así que se saltea EN_LICITACION. Fase 4 solo gobierna el estado; la
 * generación de Adjudicacion/OrdenCompra/Entrega queda a cargo del módulo de
 * adjudicaciones (Fase 7), que escucha el evento emitido acá.
 */
export async function adjudicarDirecta(id, datos, usuario) {
  const campana = await obtenerPorId(id);
  if (campana.tipo !== 'DIRECTA') {
    throw new ConflictError('adjudicarDirecta solo aplica a compras de tipo DIRECTA');
  }
  if (!puedeTransicionar(campana.tipo, campana.estado, 'ADJUDICADA')) {
    throw new ConflictError(`No se puede pasar de ${campana.estado} a ADJUDICADA (tipo DIRECTA)`);
  }

  // El módulo de adjudicaciones (Fase 7) persiste este proveedorId como FK real
  // al materializar la Cotizacion/OrdenCompra; si no existe, se valida acá antes
  // de transicionar el estado para no dejar la campaña ADJUDICADA sin órdenes.
  const proveedor = await prisma.proveedor.findUnique({ where: { id: datos.proveedorId } });
  if (!proveedor) throw new NotFoundError('Proveedor');

  const actualizada = await prisma.campana.update({
    where: { id },
    data: { estado: 'ADJUDICADA' }
  });

  eventBus.emit('COMPRA_DIRECTA_ADJUDICADA', {
    campanaId: id,
    proveedorId: datos.proveedorId,
    precioUnitario: datos.precioUnitario,
    moneda: datos.moneda,
    plazoEntregaDias: datos.plazoEntregaDias,
    condicionesPago: datos.condicionesPago,
    adjudicadaPorId: usuario.id
  });

  return actualizada;
}

/**
 * CONTINUA: dispara una "tanda". El proceso continuo (padre) no se adjudica a
 * sí mismo; crea una campaña HIJA (COLECTIVA o DIRECTA) con las intenciones
 * acumuladas re-vinculadas, y esa hija sigue el flujo normal hasta adjudicar.
 */
export async function generarTanda(id, opciones, usuario) {
  const padre = await obtenerPorId(id);
  if (padre.tipo !== 'CONTINUA') {
    throw new ConflictError('Solo un proceso CONTINUA puede generar tandas');
  }
  if (padre.estado !== 'ABIERTA') {
    throw new ConflictError('El proceso continuo debe estar ABIERTO para generar una tanda');
  }

  const tipoTanda = opciones.tipoTanda ?? 'COLECTIVA';

  return prisma.$transaction(async (tx) => {
    const intenciones = await tx.intencionCompra.findMany({ where: { campanaId: padre.id } });
    if (intenciones.length === 0) {
      throw new ValidationError('No hay intenciones acumuladas para armar la tanda');
    }

    const hija = await tx.campana.create({
      data: {
        productoId: padre.productoId,
        tipo: tipoTanda,
        nombre: `${padre.nombre} — Tanda ${new Date().toLocaleDateString('es-AR')}`,
        descripcion: padre.descripcion,
        volumenMinimo: tipoTanda === 'COLECTIVA' ? padre.volumenMinimo : null,
        fechaApertura: new Date(),
        fechaCierre: opciones.fechaCierre ?? null,
        estado: tipoTanda === 'COLECTIVA' ? 'EN_LICITACION' : 'BORRADOR',
        campanaPadreId: padre.id,
        creadaPorId: usuario.id
      }
    });

    await tx.intencionCompra.updateMany({
      where: { campanaId: padre.id },
      data: { campanaId: hija.id }
    });

    eventBus.emit('TANDA_GENERADA', { padreId: padre.id, hijaId: hija.id, tipoTanda });
    return hija;
  });
}

/**
 * Reenvío manual del aviso a productores (M3): útil si alguien no vio el
 * aviso original de CAMPANA_ABIERTA o si se actualizó algo del pedido.
 */
export async function avisarProductores(id) {
  const campana = await obtenerPorId(id);
  if (campana.estado !== 'ABIERTA') {
    throw new ConflictError('Solo se puede avisar a productores de una compra ABIERTA');
  }

  eventBus.emit('COMPRA_ACTUALIZADA', { campanaId: id, productoId: campana.productoId });
  return campana;
}

/**
 * Le avisa al proveedor ganador que la orden de compra ya está confirmada
 * (M6): hoy CAMPANA_ADJUDICADA solo notifica al equipo AUT, el proveedor no
 * se entera de que ganó hasta que alguien lo llama. Puede reenviarse las
 * veces que haga falta.
 */
export async function enviarOrdenProveedor(id) {
  const campana = await obtenerPorId(id);
  if (!['ADJUDICADA', 'CERRADA'].includes(campana.estado)) {
    throw new ConflictError('La compra todavía no fue adjudicada');
  }

  const adjudicacion = await prisma.adjudicacion.findUnique({
    where: { campanaId: id },
    include: { cotizacionGanadora: { include: { proveedor: true } } }
  });
  if (!adjudicacion) throw new ConflictError('Esta compra no tiene adjudicación');

  eventBus.emit('ORDEN_COMPRA_ENVIADA_PROVEEDOR', {
    campanaId: id,
    proveedorUsuarioId: adjudicacion.cotizacionGanadora.proveedor.usuarioId,
    productoNombre: campana.producto.nombre,
    volumenTotalAdjudicado: Number(adjudicacion.volumenTotalAdjudicado),
    precioFinalUnitario: Number(adjudicacion.precioFinalUnitario),
    unidadMedida: campana.producto.unidadMedida
  });

  return campana;
}

export async function cancelar(id, motivo) {
  const campana = await obtenerPorId(id);
  if (campana.estado === 'CERRADA' || campana.estado === 'CANCELADA') {
    throw new ConflictError('La campaña ya está finalizada');
  }

  const actualizada = await prisma.campana.update({
    where: { id },
    data: { estado: 'CANCELADA', canceladaAt: new Date(), motivoCancelacion: motivo }
  });

  eventBus.emit('CAMPANA_CANCELADA', { campanaId: id, motivo });
  return actualizada;
}
