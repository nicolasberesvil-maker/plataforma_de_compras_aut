import { prisma } from '../../config/database.js';

/**
 * Estado de cuenta consolidado de un proveedor: cuánto le compró AUT (vía
 * adjudicaciones ganadas), cuánto le pagó y cuánto le queda pendiente.
 * Carga manual de pagos (regla M2): sin conciliación automática contra
 * extracto bancario en v1.
 */
export async function obtenerCuentaCorriente(proveedorId) {
  const adjudicaciones = await prisma.adjudicacion.findMany({
    where: { cotizacionGanadora: { proveedorId } },
    include: { campana: { include: { producto: true } } },
    orderBy: { adjudicadaAt: 'desc' }
  });

  const historialCompras = adjudicaciones.map((a) => ({
    adjudicacionId: a.id,
    campana: a.campana.nombre,
    producto: a.campana.producto.nombre,
    volumen: Number(a.volumenTotalAdjudicado),
    precioUnitario: Number(a.precioFinalUnitario),
    monto: Number(a.volumenTotalAdjudicado) * Number(a.precioFinalUnitario),
    fecha: a.adjudicadaAt
  }));

  const totalAdjudicado = historialCompras.reduce((acc, c) => acc + c.monto, 0);

  const pagosDb = await prisma.pagoProveedor.findMany({
    where: { proveedorId },
    orderBy: { fecha: 'desc' }
  });

  const pagos = pagosDb.map((p) => ({
    pagoProveedorId: p.id,
    fecha: p.fecha,
    monto: Number(p.monto),
    medioPago: p.medioPago,
    adjudicacionId: p.adjudicacionId,
    observaciones: p.observaciones
  }));

  const totalPagado = pagos.reduce((acc, p) => acc + p.monto, 0);

  return {
    proveedorId,
    resumen: {
      totalAdjudicado,
      totalPagado,
      saldoPendiente: totalAdjudicado - totalPagado
    },
    historialCompras,
    pagos
  };
}

export async function registrarPago(proveedorId, datos, registradoPorId) {
  const pago = await prisma.pagoProveedor.create({
    data: {
      proveedorId,
      fecha: new Date(datos.fecha),
      monto: datos.monto,
      medioPago: datos.medioPago,
      adjudicacionId: datos.adjudicacionId,
      observaciones: datos.observaciones,
      registradoPorId
    }
  });

  return pago;
}
