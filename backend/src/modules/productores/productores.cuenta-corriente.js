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

  const porOrden = ordenes.map((o) => {
    const entregado = o.entrega?.estado === 'ENTREGADA';
    const volumenEntregado = entregado ? Number(o.volumenFinal) : 0;

    return {
      ordenCompraId: o.id,
      producto: o.adjudicacion.campana.producto.nombre,
      volumenFinal: Number(o.volumenFinal),
      volumenEntregado,
      volumenPendiente: Number(o.volumenFinal) - volumenEntregado,
      estadoEntrega: o.entrega?.estado ?? 'PENDIENTE',
      montoTotal: Number(o.total),
      estadoPago: o.estadoPago
    };
  });

  const resumen = porOrden.reduce((acc, o) => ({
    totalOrdenado: acc.totalOrdenado + o.montoTotal,
    totalEntregado: acc.totalEntregado + (o.volumenPendiente === 0 ? o.montoTotal : 0),
    totalPendienteEntrega: acc.totalPendienteEntrega + (o.volumenPendiente > 0 ? o.montoTotal : 0),
    montoTotalAdeudado: acc.montoTotalAdeudado + (o.estadoPago !== 'PAGADO' ? o.montoTotal : 0)
  }), { totalOrdenado: 0, totalEntregado: 0, totalPendienteEntrega: 0, montoTotalAdeudado: 0 });

  return { productorId, resumen, porOrden };
}
