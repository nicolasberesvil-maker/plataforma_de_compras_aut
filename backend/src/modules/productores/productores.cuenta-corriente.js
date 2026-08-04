import { prisma } from '../../config/database.js';

/**
 * Estado de cuenta consolidado de un productor: qué compró, qué ya se le
 * entregó y cuánto le falta, más el monto adeudado.
 *
 * Decisión de diseño: en v1 las órdenes son de "todo o nada" (no hay entregas
 * parciales de una misma OrdenCompra — ver 02-MODELO-DATOS.md). Por eso
 * "volumenEntregado" es simplemente volumenFinal cuando Entrega.estado =
 * ENTREGADA, y 0 en cualquier otro estado. Si en v2 se necesitan entregas
 * parciales, este es el único lugar que habría que tocar.
 */
export async function obtenerCuentaCorriente(productorId) {
  const ordenes = await prisma.ordenCompra.findMany({
    where: { productorId },
    include: {
      entrega: true,
      adjudicacion: { include: { campana: { include: { producto: true } } } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const montoPagadoPorOrden = await montoConfirmadoPorOrden(ordenes.map((o) => o.id));

  const porOrden = ordenes.map((o) => {
    const entregado = o.entrega?.estado === 'ENTREGADA';
    const volumenEntregado = entregado ? Number(o.volumenFinal) : 0;
    const montoTotal = Number(o.total);
    const montoPagado = montoPagadoPorOrden.get(o.id) ?? 0;

    return {
      ordenCompraId: o.id,
      producto: o.adjudicacion.campana.producto.nombre,
      volumenFinal: Number(o.volumenFinal),
      volumenEntregado,
      volumenPendiente: Number(o.volumenFinal) - volumenEntregado,
      estadoEntrega: o.entrega?.estado ?? 'PENDIENTE',
      montoTotal,
      montoPagado,
      montoPendiente: Math.max(0, montoTotal - montoPagado),
      estadoPago: o.estadoPago
    };
  });

  const resumen = porOrden.reduce((acc, o) => ({
    totalOrdenado: acc.totalOrdenado + o.montoTotal,
    totalEntregado: acc.totalEntregado + (o.volumenPendiente === 0 ? o.montoTotal : 0),
    totalPendienteEntrega: acc.totalPendienteEntrega + (o.volumenPendiente > 0 ? o.montoTotal : 0),
    // Antes contaba el montoTotal entero de cualquier orden no PAGADA, lo que
    // sobrestimaba la deuda de una orden PARCIAL que ya tiene pagos
    // confirmados. Ahora resta lo ya confirmado.
    montoTotalAdeudado: acc.montoTotalAdeudado + o.montoPendiente
  }), { totalOrdenado: 0, totalEntregado: 0, totalPendienteEntrega: 0, montoTotalAdeudado: 0 });

  return { productorId, resumen, porOrden };
}

/**
 * Suma, por orden, lo ya aplicado en pagos CONFIRMADOS (no cuenta lo
 * DECLARADO todavía). Usado tanto para mostrar el saldo pendiente como para
 * que pagos.service.js valide que un nuevo pago no exceda ese saldo.
 */
export async function montoConfirmadoPorOrden(ordenIds) {
  if (ordenIds.length === 0) return new Map();

  const agrupado = await prisma.pagoAplicacion.groupBy({
    by: ['ordenCompraId'],
    where: { ordenCompraId: { in: ordenIds }, pago: { estado: 'CONFIRMADO' } },
    _sum: { montoAplicado: true }
  });

  return new Map(agrupado.map((a) => [a.ordenCompraId, Number(a._sum.montoAplicado ?? 0)]));
}
