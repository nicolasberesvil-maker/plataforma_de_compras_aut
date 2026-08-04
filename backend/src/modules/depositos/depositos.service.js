import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

export async function listar({ activo = true } = {}) {
  return prisma.deposito.findMany({
    where: { activo },
    orderBy: { nombre: 'asc' }
  });
}

export async function obtenerPorId(id) {
  const deposito = await prisma.deposito.findUnique({ where: { id } });
  if (!deposito) throw new NotFoundError('Depósito');
  return deposito;
}

export async function crear(datos) {
  return prisma.deposito.create({ data: datos });
}

export async function actualizar(id, datos) {
  await obtenerPorId(id);
  return prisma.deposito.update({ where: { id }, data: datos });
}

export async function desactivar(id) {
  await obtenerPorId(id);

  const entregasActivas = await prisma.entrega.count({
    where: { depositoId: id, estado: { in: ['PENDIENTE', 'EN_TRANSITO', 'DISPONIBLE_PARA_RETIRO'] } }
  });
  if (entregasActivas > 0) {
    throw new ConflictError(`No se puede desactivar: hay ${entregasActivas} entregas activas`);
  }

  return prisma.deposito.update({ where: { id }, data: { activo: false } });
}

/**
 * Stock actual por producto en un depósito: SUM(cantidad * signo) agrupado.
 */
export async function obtenerStock(depositoId) {
  await obtenerPorId(depositoId);

  const detallado = await prisma.$queryRaw`
    SELECT producto_id AS productoId,
           SUM(cantidad * signo) AS stock
    FROM stock_movimientos
    WHERE deposito_id = ${depositoId}
    GROUP BY producto_id
  `;

  const productoIds = detallado.map((d) => d.productoId);
  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds } }
  });

  return detallado.map((d) => {
    const producto = productos.find((p) => p.id === d.productoId);
    return {
      productoId: d.productoId,
      nombreProducto: producto?.nombre,
      unidadMedida: producto?.unidadMedida,
      stockActual: Number(d.stock),
      stockMinimo: producto?.stockMinimo != null ? Number(producto.stockMinimo) : null,
      stockSeguridad: producto?.stockSeguridad != null ? Number(producto.stockSeguridad) : null
    };
  });
}
