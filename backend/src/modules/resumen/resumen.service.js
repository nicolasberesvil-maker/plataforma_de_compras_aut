import { prisma } from '../../config/database.js';
import { ForbiddenError } from '../../utils/errors.js';
import { montoConfirmadoPorOrden } from '../productores/productores.cuenta-corriente.js';

const ESTADO_INTENCION_POR_CAMPANA = {
  BORRADOR: 'AGRUPADA',
  ABIERTA: 'AGRUPADA',
  EN_LICITACION: 'EN_LICITACION'
};

/**
 * Resumen unificado de pedidos: junta IntencionCompra (todavía no
 * concretados) y OrdenCompra (ya adjudicados) en una sola lista de filas con
 * la misma forma, para que ADMIN (todos los productores, filtrable) y
 * PRODUCTOR (solo lo suyo) vean exactamente la misma tabla. Son dos fuentes
 * porque son dos fases de vida distintas del mismo pedido — Prisma no tiene
 * UNION cómodo y el volumen de datos no justifica $queryRaw, así que se
 * combinan acá en JS.
 */
export async function obtenerResumenPedidos(filtros, usuario) {
  let productorIdForzado = null;
  if (usuario.rol === 'PRODUCTOR') {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: usuario.id } });
    if (!productor) throw new ForbiddenError('Usuario no es productor');
    productorIdForzado = productor.id;
  }

  const [intenciones, ordenes] = await Promise.all([
    prisma.intencionCompra.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'AGRUPADA'] },
        ...(productorIdForzado ? { productorId: productorIdForzado } : {}),
        ...(filtros.productoId ? { productoId: filtros.productoId } : {}),
        // Filtrar con `campana: {...}` en una relación nullable excluiría las
        // filas con campanaId null (pedidos sueltos), porque Prisma exige que
        // exista una fila relacionada que matchee. El OR explícito evita
        // perder los pedidos sueltos del resumen.
        OR: [
          { campanaId: null },
          { campana: { estado: { notIn: ['ADJUDICADA', 'CERRADA'] } } }
        ]
      },
      include: {
        producto: true,
        productor: { include: { usuario: true } },
        campana: { include: { lote: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.ordenCompra.findMany({
      where: {
        ...(productorIdForzado ? { productorId: productorIdForzado } : {}),
        ...(filtros.productoId ? { adjudicacion: { campana: { productoId: filtros.productoId } } } : {})
      },
      include: {
        productor: { include: { usuario: true } },
        adjudicacion: { include: { campana: { include: { producto: true, lote: true } } } },
        entrega: { include: { deposito: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const montoPagadoPorOrden = await montoConfirmadoPorOrden(ordenes.map((o) => o.id));

  let filas = [
    ...intenciones.map(mapearIntencion),
    ...ordenes.map((o) => mapearOrden(o, montoPagadoPorOrden.get(o.id) ?? 0))
  ];

  if (filtros.loteId) filas = filas.filter((f) => f.lote?.id === filtros.loteId);
  if (filtros.search) {
    const q = filtros.search.toLowerCase();
    filas = filas.filter((f) =>
      f.productor.razonSocial.toLowerCase().includes(q) || f.productor.cuit.toLowerCase().includes(q));
  }
  if (filtros.estado) filas = filas.filter((f) => f.estadoPedido === filtros.estado);

  filas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const page = filtros.page ?? 1;
  const limit = filtros.limit ?? 20;
  const total = filas.length;
  const data = filas.slice((page - 1) * limit, page * limit);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

function mapearIntencion(i) {
  const estadoPedido = i.campanaId ? (ESTADO_INTENCION_POR_CAMPANA[i.campana.estado] ?? 'AGRUPADA') : 'SUELTO_PENDIENTE';

  return {
    origen: 'INTENCION',
    id: i.id,
    productor: { id: i.productor.id, razonSocial: i.productor.razonSocial, cuit: i.productor.cuit },
    producto: { id: i.producto.id, nombre: i.producto.nombre, unidadMedida: i.producto.unidadMedida },
    lote: i.campana?.lote ? { id: i.campana.lote.id, nombre: i.campana.lote.nombre } : null,
    volumen: Number(i.volumen),
    estadoPedido,
    formaPago: i.formasPagoPreferidas?.[0] ?? null,
    entrega: null,
    pago: null,
    campanaId: i.campanaId,
    fecha: i.createdAt
  };
}

function mapearOrden(o, montoPagado) {
  const montoTotal = Number(o.total);

  return {
    origen: 'ORDEN',
    id: o.id,
    productor: { id: o.productor.id, razonSocial: o.productor.razonSocial, cuit: o.productor.cuit },
    producto: { id: o.adjudicacion.campana.producto.id, nombre: o.adjudicacion.campana.producto.nombre, unidadMedida: o.adjudicacion.campana.producto.unidadMedida },
    lote: o.adjudicacion.campana.lote ? { id: o.adjudicacion.campana.lote.id, nombre: o.adjudicacion.campana.lote.nombre } : null,
    volumen: Number(o.volumenFinal),
    estadoPedido: `ORDEN_${o.estadoPago}`,
    formaPago: o.formaPago,
    entrega: o.entrega
      ? {
          modalidad: o.entrega.modalidad,
          estado: o.entrega.estado,
          deposito: o.entrega.deposito ? { nombre: o.entrega.deposito.nombre, localidad: o.entrega.deposito.localidad } : null,
          direccionCampo: o.entrega.direccionCampo
        }
      : null,
    pago: {
      estadoPago: o.estadoPago,
      total: montoTotal,
      montoPagado,
      montoPendiente: Math.max(0, montoTotal - montoPagado)
    },
    campanaId: o.adjudicacion.campanaId,
    fecha: o.createdAt
  };
}
