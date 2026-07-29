import { prisma } from '../../config/database.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';

const INCLUDE_DETALLE = {
  productor: true,
  adjudicacion: { include: { campana: { include: { producto: true } } } },
  entrega: true
};

export async function listarMias(usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) throw new ForbiddenError('Usuario no es productor');

  return prisma.ordenCompra.findMany({
    where: { productorId: productor.id },
    include: INCLUDE_DETALLE,
    orderBy: { createdAt: 'desc' }
  });
}

export async function listar({ estadoPago, page = 1, limit = 20 }) {
  const where = {};
  if (estadoPago) where.estadoPago = estadoPago;

  const [data, total] = await Promise.all([
    prisma.ordenCompra.findMany({
      where,
      include: INCLUDE_DETALLE,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.ordenCompra.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id, usuario) {
  const orden = await prisma.ordenCompra.findUnique({ where: { id }, include: INCLUDE_DETALLE });
  if (!orden) throw new NotFoundError('Orden');

  if (usuario.rol === 'PRODUCTOR') {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: usuario.id } });
    if (!productor || orden.productorId !== productor.id) throw new ForbiddenError();
  }

  return orden;
}

export async function definirFormaPago(id, datos, usuario) {
  await obtenerPorId(id, usuario);
  return prisma.ordenCompra.update({
    where: { id },
    data: { formaPago: datos.formaPago, cuotas: datos.cuotas },
    include: INCLUDE_DETALLE
  });
}

export async function marcarPagada(id) {
  const orden = await prisma.ordenCompra.findUnique({ where: { id } });
  if (!orden) throw new NotFoundError('Orden');

  return prisma.ordenCompra.update({ where: { id }, data: { estadoPago: 'PAGADO' }, include: INCLUDE_DETALLE });
}
