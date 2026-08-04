import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

const INCLUDE_DETALLE = {
  proveedor: { select: { razonSocial: true, cuit: true } },
  deposito: { select: { nombre: true, localidad: true } },
  registradoPor: { select: { nombre: true, apellido: true } }
};

export async function listar(campanaId) {
  return prisma.remito.findMany({
    where: { campanaId },
    include: INCLUDE_DETALLE,
    orderBy: { fecha: 'desc' }
  });
}

/**
 * Carga el remito y dispara automáticamente el StockMovimiento de tipo
 * INGRESO_PROVEEDOR correspondiente (regla M3): antes esa carga de stock se
 * hacía suelta desde el módulo de Stock; ahora queda atada a un comprobante.
 */
export async function crear(campanaId, datos, usuarioId) {
  const campana = await prisma.campana.findUnique({ where: { id: campanaId }, include: { producto: true } });
  if (!campana) throw new NotFoundError('Campaña');
  if (!['ADJUDICADA', 'CERRADA'].includes(campana.estado)) {
    throw new ConflictError('Solo se puede cargar un remito de una compra ADJUDICADA o CERRADA');
  }

  const proveedor = await prisma.proveedor.findUnique({ where: { id: datos.proveedorId } });
  if (!proveedor) throw new NotFoundError('Proveedor');

  const deposito = await prisma.deposito.findUnique({ where: { id: datos.depositoId } });
  if (!deposito) throw new NotFoundError('Depósito');

  return prisma.$transaction(async (tx) => {
    const movimiento = await tx.stockMovimiento.create({
      data: {
        depositoId: datos.depositoId,
        productoId: campana.productoId,
        tipo: 'INGRESO_PROVEEDOR',
        cantidad: datos.cantidadRecibida,
        signo: 1,
        proveedorOrigen: proveedor.razonSocial,
        observaciones: `Remito ${datos.numero} — ${campana.nombre}`,
        ejecutadoPorId: usuarioId
      }
    });

    return tx.remito.create({
      data: {
        campanaId,
        proveedorId: datos.proveedorId,
        depositoId: datos.depositoId,
        numero: datos.numero,
        fecha: datos.fecha,
        cantidadRecibida: datos.cantidadRecibida,
        observaciones: datos.observaciones,
        adjuntoUrl: datos.adjuntoUrl,
        movimientoStockId: movimiento.id,
        registradoPorId: usuarioId
      },
      include: INCLUDE_DETALLE
    });
  });
}
