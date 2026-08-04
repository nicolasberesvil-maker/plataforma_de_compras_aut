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

/** Historial de ventas del proveedor: órdenes generadas a partir de sus cotizaciones ganadoras. */
export async function listarMiasProveedor(usuarioId) {
  const proveedor = await prisma.proveedor.findUnique({ where: { usuarioId } });
  if (!proveedor) throw new ForbiddenError('Usuario no es proveedor');

  return prisma.ordenCompra.findMany({
    where: { adjudicacion: { cotizacionGanadora: { proveedorId: proveedor.id } } },
    include: INCLUDE_DETALLE,
    orderBy: { createdAt: 'desc' }
  });
}

export async function listar({ estadoPago, campanaId, page = 1, limit = 20 }) {
  const where = {};
  if (estadoPago) where.estadoPago = estadoPago;
  if (campanaId) where.adjudicacion = { campanaId };

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
  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: { ...INCLUDE_DETALLE, adjudicacion: { include: { campana: { include: { producto: true } }, cotizacionGanadora: true } } }
  });
  if (!orden) throw new NotFoundError('Orden');

  if (usuario.rol === 'PRODUCTOR') {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: usuario.id } });
    if (!productor || orden.productorId !== productor.id) throw new ForbiddenError();
  }

  if (usuario.rol === 'PROVEEDOR') {
    const proveedor = await prisma.proveedor.findUnique({ where: { usuarioId: usuario.id } });
    if (!proveedor || orden.adjudicacion.cotizacionGanadora.proveedorId !== proveedor.id) throw new ForbiddenError();
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
