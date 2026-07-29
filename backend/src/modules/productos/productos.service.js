import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

export async function listar({ categoria, activo, search, page = 1, limit = 20 }) {
  const where = {};
  if (categoria) where.categoria = categoria;
  if (activo !== undefined) where.activo = activo;
  if (search) {
    where.OR = [
      { nombre: { contains: search } },
      { descripcion: { contains: search } }
    ];
  }

  const [data, total] = await Promise.all([
    prisma.producto.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { nombre: 'asc' }
    }),
    prisma.producto.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id) {
  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) throw new NotFoundError('Producto');
  return producto;
}

export async function crear(datos) {
  return prisma.producto.create({ data: datos });
}

export async function actualizar(id, datos) {
  await obtenerPorId(id);
  return prisma.producto.update({ where: { id }, data: datos });
}

export async function desactivar(id) {
  await obtenerPorId(id);

  const campanaActiva = await prisma.campana.findFirst({
    where: { productoId: id, estado: { in: ['ABIERTA', 'EN_LICITACION'] } }
  });
  if (campanaActiva) {
    throw new ConflictError('No se puede desactivar: el producto tiene campañas ABIERTA o EN_LICITACION');
  }

  return prisma.producto.update({ where: { id }, data: { activo: false } });
}
