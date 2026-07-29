import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Comparador de cotizaciones de una campaña COLECTIVA en licitación.
 * Incluye cuántas campañas ganó cada proveedor antes (ranking histórico).
 */
export async function obtenerComparador(campanaId) {
  const campana = await prisma.campana.findUnique({
    where: { id: campanaId },
    include: { producto: true }
  });
  if (!campana) throw new NotFoundError('Campaña');
  if (campana.estado !== 'EN_LICITACION') {
    throw new ConflictError('La campaña no está en licitación');
  }

  const [cotizaciones, stats] = await Promise.all([
    prisma.cotizacion.findMany({
      where: { campanaId },
      include: { proveedor: true }
    }),
    prisma.intencionCompra.aggregate({
      where: { campanaId },
      _sum: { volumen: true },
      _count: true
    })
  ]);

  const proveedorIds = [...new Set(cotizaciones.map((c) => c.proveedorId))];
  const ranking = proveedorIds.length
    ? await prisma.adjudicacion.groupBy({
        by: ['cotizacionGanadoraId'],
        where: { cotizacionGanadora: { proveedorId: { in: proveedorIds } } },
        _count: true
      })
    : [];
  const cotizacionesGanadorasPorProveedor = proveedorIds.length
    ? await prisma.cotizacion.findMany({
        where: { id: { in: ranking.map((r) => r.cotizacionGanadoraId) } },
        select: { id: true, proveedorId: true }
      })
    : [];
  const campanasGanadasPorProveedor = new Map();
  for (const r of ranking) {
    const cot = cotizacionesGanadorasPorProveedor.find((c) => c.id === r.cotizacionGanadoraId);
    if (!cot) continue;
    campanasGanadasPorProveedor.set(cot.proveedorId, (campanasGanadasPorProveedor.get(cot.proveedorId) ?? 0) + r._count);
  }

  const volumenConsolidado = Number(stats._sum.volumen ?? 0);

  return {
    campana: {
      id: campana.id,
      nombre: campana.nombre,
      producto: campana.producto,
      volumenConsolidado,
      cantidadProductores: stats._count
    },
    cotizaciones: cotizaciones
      .map((c) => ({
        id: c.id,
        proveedor: {
          id: c.proveedor.id,
          razonSocial: c.proveedor.razonSocial,
          cuit: c.proveedor.cuit
        },
        precioUnitario: Number(c.precioUnitario),
        monedaPrecio: c.monedaPrecio,
        plazoEntregaDias: c.plazoEntregaDias,
        tasaInteresMensual: c.tasaInteresMensual ? Number(c.tasaInteresMensual) : null,
        condicionesPago: c.condicionesPago,
        observaciones: c.observaciones,
        validaHasta: c.validaHasta,
        campanasGanadasPrevias: campanasGanadasPorProveedor.get(c.proveedorId) ?? 0,
        costoTotalEstimado: Number(c.precioUnitario) * volumenConsolidado
      }))
      .sort((a, b) => a.precioUnitario - b.precioUnitario)
  };
}

/**
 * Adjudica una campaña COLECTIVA eligiendo una cotización ganadora.
 * Operación atómica: adjudicación + ordenes + entregas, o nada.
 */
export async function adjudicar(datos) {
  const { campanaId, cotizacionGanadoraId, precioMinoristaReferencia, motivoEleccion } = datos;

  const resultado = await prisma.$transaction(async (tx) => {
    const campana = await tx.campana.findUnique({ where: { id: campanaId } });
    if (!campana) throw new NotFoundError('Campaña');
    if (campana.estado !== 'EN_LICITACION') {
      throw new ConflictError(`No se puede adjudicar: estado actual es ${campana.estado}`);
    }

    const cotizacionGanadora = await tx.cotizacion.findUnique({ where: { id: cotizacionGanadoraId } });
    if (!cotizacionGanadora || cotizacionGanadora.campanaId !== campanaId) {
      throw new ValidationError('La cotización no pertenece a esta campaña');
    }

    const materializado = await materializarAdjudicacion(tx, {
      campanaId,
      cotizacionGanadora,
      precioMinoristaReferencia,
      motivoEleccion
    });

    await tx.campana.update({ where: { id: campanaId }, data: { estado: 'ADJUDICADA' } });

    return materializado;
  }, { isolationLevel: 'Serializable', timeout: 30000 });

  emitirEventosAdjudicacion(resultado);
  return resultado.adjudicacion;
}

/**
 * Núcleo compartido: crea Adjudicacion + una OrdenCompra/Entrega por cada
 * IntencionCompra válida. Usado tanto por `adjudicar` (COLECTIVA, manual)
 * como por el listener de COMPRA_DIRECTA_ADJUDICADA (DIRECTA, automático) —
 * a partir de acá el flujo es idéntico sin importar el tipo de campaña.
 */
async function materializarAdjudicacion(tx, { campanaId, cotizacionGanadora, precioMinoristaReferencia, motivoEleccion }) {
  const campana = await tx.campana.findUnique({ where: { id: campanaId }, include: { producto: true } });

  const intenciones = await tx.intencionCompra.findMany({ where: { campanaId } });
  if (intenciones.length === 0) {
    throw new ConflictError('No hay intenciones para adjudicar');
  }

  const volumenTotal = intenciones.reduce((sum, i) => sum + Number(i.volumen), 0);
  const precioFinal = Number(cotizacionGanadora.precioUnitario);
  const ahorroEstimado = precioMinoristaReferencia
    ? (Number(precioMinoristaReferencia) - precioFinal) * volumenTotal
    : null;
  const porcentajeAhorro = precioMinoristaReferencia && Number(precioMinoristaReferencia) > 0
    ? ((Number(precioMinoristaReferencia) - precioFinal) / Number(precioMinoristaReferencia)) * 100
    : null;

  const adjudicacion = await tx.adjudicacion.create({
    data: {
      campanaId,
      cotizacionGanadoraId: cotizacionGanadora.id,
      volumenTotalAdjudicado: volumenTotal,
      precioFinalUnitario: precioFinal,
      precioMinoristaReferencia: precioMinoristaReferencia ?? null,
      ahorroEstimadoTotal: ahorroEstimado,
      porcentajeAhorro,
      motivoEleccion
    }
  });

  await tx.cotizacion.update({ where: { id: cotizacionGanadora.id }, data: { esGanadora: true } });

  const alicuotaIva = Number(campana.producto.alicuotaIva) / 100;
  const ordenes = [];

  for (const intencion of intenciones) {
    const volumenFinal = Number(intencion.volumen);
    const subtotal = volumenFinal * precioFinal;
    const iva = subtotal * alicuotaIva;
    const total = subtotal + iva;
    const ahorroEstimadoOrden = ahorroEstimado ? (ahorroEstimado / volumenTotal) * volumenFinal : null;

    const orden = await tx.ordenCompra.create({
      data: {
        adjudicacionId: adjudicacion.id,
        productorId: intencion.productorId,
        volumenFinal,
        precioUnitario: precioFinal,
        subtotal,
        iva,
        total,
        ahorroEstimado: ahorroEstimadoOrden,
        porcentajeAhorro,
        estadoPago: 'PENDIENTE'
      }
    });

    await tx.entrega.create({
      data: {
        ordenCompraId: orden.id,
        productorId: intencion.productorId,
        modalidad: intencion.modalidadEntregaPreferida ?? 'RETIRO_EN_DEPOSITO',
        estado: 'PENDIENTE'
      }
    });

    ordenes.push(orden);
  }

  return { adjudicacion, ordenes, cotizacionGanadora, campanaId };
}

function emitirEventosAdjudicacion({ adjudicacion, ordenes, cotizacionGanadora, campanaId }) {
  eventBus.emit('CAMPANA_ADJUDICADA', {
    adjudicacionId: adjudicacion.id,
    campanaId,
    cotizacionGanadoraId: cotizacionGanadora.id
  });

  for (const orden of ordenes) {
    eventBus.emit('ORDEN_GENERADA', {
      ordenId: orden.id,
      productorId: orden.productorId,
      campanaId,
      precioFinalUnitario: Number(orden.precioUnitario),
      total: Number(orden.total),
      porcentajeAhorro: orden.porcentajeAhorro ? Number(orden.porcentajeAhorro) : null
    });
  }

  prisma.cotizacion.findMany({ where: { campanaId, esGanadora: false } })
    .then((rechazadas) => {
      for (const c of rechazadas) {
        eventBus.emit('COTIZACION_RECHAZADA', { cotizacionId: c.id, proveedorId: c.proveedorId });
      }
    })
    .catch((err) => logger.error({ err, campanaId }, 'Error notificando cotizaciones rechazadas'));
}

/**
 * Listener de campanas.service.js → adjudicarDirecta. La campaña DIRECTA ya
 * quedó en ADJUDICADA en el módulo de campañas; acá se crea una Cotizacion
 * sintética (esGanadora=true) con los datos que ya cargó AUT, y se reutiliza
 * el mismo núcleo de materialización que la adjudicación COLECTIVA.
 */
export async function procesarAdjudicacionDirecta(payload) {
  const { campanaId, proveedorId, precioUnitario, moneda, plazoEntregaDias, condicionesPago } = payload;

  const resultado = await prisma.$transaction(async (tx) => {
    const existente = await tx.adjudicacion.findUnique({ where: { campanaId } });
    if (existente) return null; // ya procesada (evita duplicar si el evento se reemite)

    const cotizacionGanadora = await tx.cotizacion.create({
      data: {
        campanaId,
        proveedorId,
        precioUnitario,
        monedaPrecio: moneda ?? 'ARS',
        plazoEntregaDias: plazoEntregaDias ?? 0,
        condicionesPago: condicionesPago ?? 'Compra directa',
        validaHasta: new Date(),
        esGanadora: true
      }
    });

    return materializarAdjudicacion(tx, { campanaId, cotizacionGanadora, precioMinoristaReferencia: null, motivoEleccion: null });
  }, { isolationLevel: 'Serializable', timeout: 30000 });

  if (resultado) emitirEventosAdjudicacion(resultado);
}

export async function obtenerPorId(id) {
  const adjudicacion = await prisma.adjudicacion.findUnique({
    where: { id },
    include: {
      campana: { include: { producto: true } },
      cotizacionGanadora: { include: { proveedor: true } },
      ordenes: { include: { productor: true } }
    }
  });
  if (!adjudicacion) throw new NotFoundError('Adjudicación');
  return adjudicacion;
}

export async function obtenerPorCampana(campanaId) {
  const adjudicacion = await prisma.adjudicacion.findUnique({
    where: { campanaId },
    include: {
      campana: { include: { producto: true } },
      cotizacionGanadora: { include: { proveedor: true } },
      ordenes: { include: { productor: true } }
    }
  });
  if (!adjudicacion) throw new NotFoundError('Adjudicación');
  return adjudicacion;
}

export async function listar({ page = 1, limit = 20 }) {
  const [data, total] = await Promise.all([
    prisma.adjudicacion.findMany({
      include: { campana: { include: { producto: true } }, cotizacionGanadora: { include: { proveedor: true } } },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { adjudicadaAt: 'desc' }
    }),
    prisma.adjudicacion.count()
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
