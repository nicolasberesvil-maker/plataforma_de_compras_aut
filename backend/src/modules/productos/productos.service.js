import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../utils/errors.js';

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
  // TODO(nicolas, fase-4): validar que no haya campañas ABIERTA/EN_LICITACION
  // con este producto antes de desactivar (regla documentada en 08-FASE-3-PRODUCTOS.md).
  // El modelo Campana todavía no existe (se crea en Fase 4), así que por ahora
  // es un soft-delete sin esa validación.
  await obtenerPorId(id);
  return prisma.producto.update({ where: { id }, data: { activo: false } });
}
