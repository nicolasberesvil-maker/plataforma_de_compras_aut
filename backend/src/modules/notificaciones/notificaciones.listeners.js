import { prisma } from '../../config/database.js';
import { eventBus } from '../../services/event-bus.service.js';
import * as notificacionesService from './notificaciones.service.js';
import * as productorService from '../productores/productores.service.js';
import * as proveedorService from '../proveedores/proveedores.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Registra los listeners de notificaciones. Se llama una sola vez al iniciar la app.
 */
export function registrarListenersNotificaciones() {
  eventBus.on('PRODUCTOR_APROBADO', onProductorAprobado);
  eventBus.on('PROVEEDOR_APROBADO', onProveedorAprobado);
  eventBus.on('SOLICITUD_RECIBIDA', onSolicitudRecibida);
  eventBus.on('SOLICITUD_AGRUPADA', onSolicitudAgrupada);
  eventBus.on('SOLICITUD_DESCARTADA', onSolicitudDescartada);
  eventBus.on('CAMPANA_ABIERTA', onCampanaAbierta);
  eventBus.on('CAMPANA_PROXIMA_A_CERRAR', onCampanaProximaACerrar);
  eventBus.on('CAMPANA_CERRADA', onCampanaCerrada);
  eventBus.on('CAMPANA_CANCELADA', onCampanaCancelada);
  eventBus.on('COMPRA_DIRECTA_ADJUDICADA', onCompraDirectaAdjudicada);
  eventBus.on('TANDA_GENERADA', onTandaGenerada);
  eventBus.on('RFQ_ABIERTO', onRfqAbierto);
  eventBus.on('CAMPANA_ADJUDICADA', onCampanaAdjudicada);
  eventBus.on('ORDEN_GENERADA', onOrdenGenerada);
  eventBus.on('COTIZACION_RECHAZADA', onCotizacionRechazada);
  eventBus.on('ENTREGA_EN_TRANSITO', onEntregaEnTransito);
  eventBus.on('ENTREGA_DISPONIBLE', onEntregaDisponible);
  eventBus.on('ENTREGA_CONFIRMADA', onEntregaConfirmada);
  eventBus.on('FACTURA_EMITIDA', onFacturaEmitida);

  logger.info('Listeners de notificaciones registrados');
}

async function onProductorAprobado({ productorId, usuarioId }) {
  try {
    await notificacionesService.crearYEnviar({
      usuarioId,
      tipo: 'PRODUCTOR_APROBADO',
      titulo: 'Tu cuenta fue aprobada',
      mensaje: 'Ya podés pedir productos y sumarte a las compras colectivas de AUT.',
      enlaceRelativo: '/perfil'
    });
  } catch (err) {
    logger.error({ err, productorId }, 'Error notificando PRODUCTOR_APROBADO');
  }
}

async function onProveedorAprobado({ proveedorId }) {
  try {
    const proveedor = await proveedorService.obtenerPorId(proveedorId);
    await notificacionesService.crearYEnviar({
      usuarioId: proveedor.usuarioId,
      tipo: 'PROVEEDOR_APROBADO',
      titulo: 'Tu cuenta de proveedor fue aprobada',
      mensaje: 'Ya podés recibir pedidos de cotización de AUT.',
      enlaceRelativo: '/perfil'
    });
  } catch (err) {
    logger.error({ err, proveedorId }, 'Error notificando PROVEEDOR_APROBADO');
  }
}

/**
 * Notifica a todo el equipo de AUT (ADMIN/OPERADOR) que hay un pedido suelto
 * (IntencionCompra con campanaId null) esperando revisión para agrupar.
 */
async function onSolicitudRecibida({ intencionId, productoId }) {
  try {
    const producto = await prisma.producto.findUnique({ where: { id: productoId } });
    const staffAut = await prisma.usuario.findMany({
      where: { rol: { in: ['ADMIN', 'OPERADOR'] }, activo: true }
    });

    for (const usuario of staffAut) {
      await notificacionesService.crearYEnviar({
        usuarioId: usuario.id,
        tipo: 'SOLICITUD_RECIBIDA',
        titulo: 'Nuevo pedido de compra',
        mensaje: `Un productor pidió ${producto?.nombre ?? 'un producto'}. Revisalo para armar un requerimiento.`,
        enlaceRelativo: '/admin/solicitudes',
        metadatos: { intencionId, productoId }
      });
    }
  } catch (err) {
    logger.error({ err, intencionId }, 'Error notificando SOLICITUD_RECIBIDA');
  }
}

async function onSolicitudAgrupada({ productorId, campanaId, intencionId }) {
  try {
    const productor = await productorService.obtenerPorId(productorId);
    const campana = await prisma.campana.findUnique({ where: { id: campanaId }, include: { producto: true } });

    await notificacionesService.crearYEnviar({
      usuarioId: productor.usuarioId,
      tipo: 'SOLICITUD_AGRUPADA',
      titulo: 'Tu pedido se sumó a una compra colectiva',
      mensaje: `Tu pedido de ${campana.producto.nombre} se incluyó en "${campana.nombre}".`,
      enlaceRelativo: `/campanas/${campanaId}`,
      metadatos: { campanaId, intencionId }
    });
  } catch (err) {
    logger.error({ err, intencionId }, 'Error notificando SOLICITUD_AGRUPADA');
  }
}

async function onSolicitudDescartada({ productorId, motivo, intencionId }) {
  try {
    const productor = await productorService.obtenerPorId(productorId);
    await notificacionesService.crearYEnviar({
      usuarioId: productor.usuarioId,
      tipo: 'SOLICITUD_DESCARTADA',
      titulo: 'Tu pedido fue descartado',
      mensaje: motivo,
      enlaceRelativo: '/mis-pedidos',
      metadatos: { intencionId }
    });
  } catch (err) {
    logger.error({ err, intencionId }, 'Error notificando SOLICITUD_DESCARTADA');
  }
}

async function onCampanaAbierta({ campanaId, productoId }) {
  try {
    const campana = await prisma.campana.findUnique({ where: { id: campanaId }, include: { producto: true } });
    const productores = await productorService.listarAprobados();

    for (const productor of productores) {
      await notificacionesService.crearYEnviar({
        usuarioId: productor.usuarioId,
        tipo: 'CAMPANA_ABIERTA',
        titulo: 'Nueva compra colectiva abierta',
        mensaje: `Se abrió "${campana.nombre}" (${campana.producto.nombre}). Sumate antes del cierre.`,
        enlaceRelativo: `/campanas/${campanaId}`,
        metadatos: { campanaId, productoId }
      });
    }
  } catch (err) {
    logger.error({ err, campanaId }, 'Error notificando CAMPANA_ABIERTA');
  }
}

/** 48 hs antes del cierre: avisa solo a quienes todavía no cargaron intención. */
async function onCampanaProximaACerrar({ campanaId }) {
  try {
    const campana = await prisma.campana.findUnique({ where: { id: campanaId }, include: { producto: true } });
    const [productores, yaCargaron] = await Promise.all([
      productorService.listarAprobados(),
      prisma.intencionCompra.findMany({ where: { campanaId }, select: { productorId: true } })
    ]);

    const idsConIntencion = new Set(yaCargaron.map((i) => i.productorId));
    const pendientes = productores.filter((p) => !idsConIntencion.has(p.id));

    for (const productor of pendientes) {
      await notificacionesService.crearYEnviar({
        usuarioId: productor.usuarioId,
        tipo: 'CAMPANA_PROXIMA_A_CERRAR',
        titulo: 'Una compra colectiva cierra pronto',
        mensaje: `"${campana.nombre}" (${campana.producto.nombre}) cierra en menos de 48 hs. Todavía no cargaste tu pedido.`,
        enlaceRelativo: `/campanas/${campanaId}`,
        metadatos: { campanaId }
      });
    }
  } catch (err) {
    logger.error({ err, campanaId }, 'Error notificando CAMPANA_PROXIMA_A_CERRAR');
  }
}

/** Pasó a licitación: avisa a quienes sí cargaron intención (les interesa el resultado). */
async function onCampanaCerrada({ campanaId }) {
  try {
    const campana = await prisma.campana.findUnique({ where: { id: campanaId }, include: { producto: true } });
    const intenciones = await prisma.intencionCompra.findMany({
      where: { campanaId },
      include: { productor: true }
    });

    for (const intencion of intenciones) {
      await notificacionesService.crearYEnviar({
        usuarioId: intencion.productor.usuarioId,
        tipo: 'CAMPANA_CERRADA',
        titulo: 'Tu compra colectiva pasó a licitación',
        mensaje: `"${campana.nombre}" (${campana.producto.nombre}) cerró la carga de pedidos. AUT ya está cotizando con proveedores.`,
        enlaceRelativo: `/campanas/${campanaId}`,
        metadatos: { campanaId }
      });
    }
  } catch (err) {
    logger.error({ err, campanaId }, 'Error notificando CAMPANA_CERRADA');
  }
}

async function onCampanaCancelada({ campanaId, motivo }) {
  try {
    const campana = await prisma.campana.findUnique({ where: { id: campanaId }, include: { producto: true } });
    const intenciones = await prisma.intencionCompra.findMany({
      where: { campanaId },
      include: { productor: true }
    });

    for (const intencion of intenciones) {
      await notificacionesService.crearYEnviar({
        usuarioId: intencion.productor.usuarioId,
        tipo: 'CAMPANA_CANCELADA',
        titulo: 'Una compra colectiva fue cancelada',
        mensaje: `"${campana.nombre}" (${campana.producto.nombre}) se canceló. Motivo: ${motivo}`,
        enlaceRelativo: `/campanas/${campanaId}`,
        metadatos: { campanaId }
      });
    }
  } catch (err) {
    logger.error({ err, campanaId }, 'Error notificando CAMPANA_CANCELADA');
  }
}

// COMPRA_DIRECTA_ADJUDICADA y TANDA_GENERADA no están en el catálogo de
// 04-NOTIFICACIONES.md (no tienen audiencia/copy definidos todavía) — se
// loguean para no perder el evento hasta que se defina esa notificación.
function onCompraDirectaAdjudicada({ campanaId, proveedorId }) {
  logger.info({ campanaId, proveedorId }, 'TODO: notificación COMPRA_DIRECTA_ADJUDICADA sin definir');
}

function onTandaGenerada({ padreId, hijaId, tipoTanda }) {
  logger.info({ padreId, hijaId, tipoTanda }, 'TODO: notificación TANDA_GENERADA sin definir');
}

/** AUT adjudicó la campaña: avisa a todo el equipo (ORDEN_GENERADA ya avisa a cada productor). */
async function onCampanaAdjudicada({ campanaId }) {
  try {
    const campana = await prisma.campana.findUnique({ where: { id: campanaId }, include: { producto: true } });
    const staffAut = await prisma.usuario.findMany({ where: { rol: { in: ['ADMIN', 'OPERADOR'] }, activo: true } });

    for (const usuario of staffAut) {
      await notificacionesService.crearYEnviar({
        usuarioId: usuario.id,
        tipo: 'CAMPANA_ADJUDICADA',
        titulo: 'Campaña adjudicada',
        mensaje: `"${campana.nombre}" (${campana.producto.nombre}) fue adjudicada.`,
        enlaceRelativo: `/admin/campanas/${campanaId}`,
        metadatos: { campanaId }
      });
    }
  } catch (err) {
    logger.error({ err, campanaId }, 'Error notificando CAMPANA_ADJUDICADA');
  }
}

/**
 * El productor tiene que enterarse EN EL MOMENTO de que su compra se
 * concretó, a qué precio y cuánto ahorró vs. comprar individual (regla D.4).
 */
async function onOrdenGenerada({ ordenId, productorId, porcentajeAhorro, precioFinalUnitario, total }) {
  try {
    const productor = await productorService.obtenerPorId(productorId);
    const fraseAhorro = porcentajeAhorro ? ` Ahorraste un ${Number(porcentajeAhorro).toFixed(1)}% comprando en grupo.` : '';

    await notificacionesService.crearYEnviar({
      usuarioId: productor.usuarioId,
      tipo: 'ORDEN_GENERADA',
      titulo: 'Tu compra se concretó',
      mensaje: `Se confirmó tu compra a $${Number(precioFinalUnitario).toFixed(2)} por unidad (total $${Number(total).toFixed(2)}).${fraseAhorro}`,
      enlaceRelativo: `/productor/mis-ordenes/${ordenId}`,
      metadatos: { ordenId, precioFinalUnitario, total, porcentajeAhorro }
    });
  } catch (err) {
    logger.error({ err, ordenId }, 'Error notificando ORDEN_GENERADA');
  }
}

async function onCotizacionRechazada({ cotizacionId, proveedorId }) {
  try {
    const proveedor = await proveedorService.obtenerPorId(proveedorId);
    await notificacionesService.crearYEnviar({
      usuarioId: proveedor.usuarioId,
      tipo: 'COTIZACION_RECHAZADA',
      titulo: 'Tu cotización no fue elegida',
      mensaje: 'La campaña que cotizaste ya fue adjudicada a otro proveedor. Gracias por participar.',
      enlaceRelativo: '/proveedor/mis-cotizaciones',
      metadatos: { cotizacionId }
    });
  } catch (err) {
    logger.error({ err, cotizacionId }, 'Error notificando COTIZACION_RECHAZADA');
  }
}

async function onEntregaEnTransito({ entregaId, productorId }) {
  try {
    const productor = await productorService.obtenerPorId(productorId);
    await notificacionesService.crearYEnviar({
      usuarioId: productor.usuarioId,
      tipo: 'ENTREGA_EN_TRANSITO',
      titulo: 'Tu mercadería está en camino',
      mensaje: 'AUT ya despachó tu pedido.',
      enlaceRelativo: `/entregas/${entregaId}`,
      metadatos: { entregaId }
    });
  } catch (err) {
    logger.error({ err, entregaId }, 'Error notificando ENTREGA_EN_TRANSITO');
  }
}

/** Notif más importante del módulo: el productor tiene que enterarse YA de que puede pasar a retirar. */
async function onEntregaDisponible({ entregaId, productorId, depositoId }) {
  try {
    const [productor, deposito] = await Promise.all([
      productorService.obtenerPorId(productorId),
      prisma.deposito.findUnique({ where: { id: depositoId } })
    ]);

    await notificacionesService.crearYEnviar({
      usuarioId: productor.usuarioId,
      tipo: 'ENTREGA_DISPONIBLE',
      titulo: 'Tu mercadería está lista para retirar',
      mensaje: `Podés pasar a retirar por ${deposito.nombre}, ${deposito.direccion}, ${deposito.localidad}.${deposito.horarioAtencion ? ` Horario: ${deposito.horarioAtencion}.` : ''}`,
      enlaceRelativo: `/entregas/${entregaId}`,
      metadatos: { entregaId, depositoId }
    });
  } catch (err) {
    logger.error({ err, entregaId }, 'Error notificando ENTREGA_DISPONIBLE');
  }
}

async function onEntregaConfirmada({ entregaId, productorId }) {
  try {
    const productor = await productorService.obtenerPorId(productorId);
    await notificacionesService.crearYEnviar({
      usuarioId: productor.usuarioId,
      tipo: 'ENTREGA_CONFIRMADA',
      titulo: 'Entrega confirmada',
      mensaje: 'Confirmamos que recibiste tu pedido. ¡Gracias por comprar en grupo con AUT!',
      enlaceRelativo: `/entregas/${entregaId}`,
      metadatos: { entregaId }
    });
  } catch (err) {
    logger.error({ err, entregaId }, 'Error notificando ENTREGA_CONFIRMADA');
  }
}

async function onFacturaEmitida({ facturaId, ordenId, productorId, total }) {
  try {
    const productor = await productorService.obtenerPorId(productorId);
    await notificacionesService.crearYEnviar({
      usuarioId: productor.usuarioId,
      tipo: 'FACTURA_EMITIDA',
      titulo: 'Se emitió tu factura',
      mensaje: `Ya está disponible tu factura por $${Number(total).toFixed(2)}. Podés descargarla desde tu portal.`,
      enlaceRelativo: '/productor/mis-facturas',
      metadatos: { facturaId, ordenId }
    });
  } catch (err) {
    logger.error({ err, facturaId }, 'Error notificando FACTURA_EMITIDA');
  }
}

/** Se abrió la licitación: avisa a TODOS los proveedores aprobados (todavía no hay cotizaciones). */
async function onRfqAbierto({ campanaId, volumenConsolidado }) {
  try {
    const campana = await prisma.campana.findUnique({ where: { id: campanaId }, include: { producto: true } });
    const proveedores = await proveedorService.listarAprobados();

    for (const proveedor of proveedores) {
      await notificacionesService.crearYEnviar({
        usuarioId: proveedor.usuarioId,
        tipo: 'RFQ_RECIBIDO',
        titulo: 'Nueva licitación disponible',
        mensaje: `Hay una nueva campaña para cotizar: ${campana.producto.nombre}. Volumen: ${volumenConsolidado} ${campana.producto.unidadMedida}.`,
        enlaceRelativo: `/proveedor/campanas/${campanaId}`,
        metadatos: { campanaId, volumenConsolidado }
      });
    }
  } catch (err) {
    logger.error({ err, campanaId }, 'Error notificando RFQ_ABIERTO');
  }
}
