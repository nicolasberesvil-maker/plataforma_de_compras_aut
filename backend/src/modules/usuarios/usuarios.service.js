import bcrypt from 'bcrypt';
import { prisma } from '../../config/database.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';

const BCRYPT_COST = 12;

export async function listar({ rol, activo, search, page = 1, limit = 20 }) {
  const where = {};
  if (rol) where.rol = rol;
  if (activo !== undefined) where.activo = activo;
  if (search) {
    where.OR = [
      { username: { contains: search } },
      { email: { contains: search } },
      { nombre: { contains: search } },
      { apellido: { contains: search } }
    ];
  }

  const [data, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      select: {
        id: true, username: true, email: true, nombre: true, apellido: true,
        telefono: true, rol: true, activo: true,
        createdAt: true, ultimoLoginAt: true
      },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.usuario.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id, usuarioSolicitante) {
  if (usuarioSolicitante.rol !== 'ADMIN' && usuarioSolicitante.id !== id) {
    throw new ForbiddenError('Solo podés ver tus propios datos');
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id },
    include: { productor: true, proveedor: true }
  });
  if (!usuario) throw new NotFoundError('Usuario');

  const { passwordHash, ...resto } = usuario;
  return resto;
}

export async function actualizar(id, datos, usuarioSolicitante) {
  if (usuarioSolicitante.rol !== 'ADMIN' && usuarioSolicitante.id !== id) {
    throw new ForbiddenError();
  }

  // Solo un admin puede reasignar el rol de otro usuario.
  const rolNuevo = usuarioSolicitante.rol === 'ADMIN' ? datos.rol : undefined;

  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw new NotFoundError('Usuario');

  return prisma.usuario.update({
    where: { id },
    data: {
      nombre: datos.nombre,
      apellido: datos.apellido,
      telefono: datos.telefono,
      ...(rolNuevo && { rol: rolNuevo })
    },
    select: { id: true, username: true, email: true, nombre: true, apellido: true, telefono: true, rol: true, activo: true }
  });
}

export async function cambiarEstado(id, activo) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw new NotFoundError('Usuario');

  return prisma.usuario.update({
    where: { id },
    data: { activo },
    select: { id: true, username: true, email: true, activo: true }
  });
}

export async function cambiarPassword(id, passwordActual, passwordNueva) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw new NotFoundError('Usuario');

  const ok = await bcrypt.compare(passwordActual, usuario.passwordHash);
  if (!ok) throw new ForbiddenError('Contraseña actual incorrecta');

  const passwordHash = await bcrypt.hash(passwordNueva, BCRYPT_COST);
  await prisma.usuario.update({ where: { id }, data: { passwordHash } });
}
