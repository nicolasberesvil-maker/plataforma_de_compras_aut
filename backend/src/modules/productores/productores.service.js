import bcrypt from 'bcrypt';
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors.js';

const BCRYPT_COST = 12;

export async function listar({ search, estado, page = 1, limit = 20 }) {
  const where = {};
  if (search) {
    where.OR = [
      { razonSocial: { contains: search } },
      { cuit: { contains: search } },
      { usuario: { nombre: { contains: search } } },
      { usuario: { apellido: { contains: search } } }
    ];
  }
  if (estado) where.usuario = { ...where.usuario, activo: estado === 'ACTIVO' };

  const [data, total] = await Promise.all([
    prisma.productor.findMany({
      where,
      include: { usuario: { select: { email: true, nombre: true, apellido: true, activo: true } } },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.productor.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// Usado por el módulo de notificaciones (avisos masivos a productores activos).
export async function listarAprobados() {
  return prisma.productor.findMany({
    where: { usuario: { activo: true } },
    include: { usuario: true }
  });
}

export async function obtenerPorId(id, usuarioSolicitante) {
  const productor = await prisma.productor.findUnique({
    where: { id },
    include: { usuario: true }
  });
  if (!productor) throw new NotFoundError('Productor');

  if (usuarioSolicitante && usuarioSolicitante.rol !== 'ADMIN' && usuarioSolicitante.id !== productor.usuarioId) {
    throw new ForbiddenError('Solo podés ver tus propios datos');
  }

  return productor;
}

/**
 * Alta manual de productor por ADMIN. Crea Usuario + Productor en una
 * transacción, ya activo (sin estado de aprobación pendiente). El ADMIN
 * tipea usuario y contraseña a mano y se los comunica a la persona por
 * fuera del sistema.
 */
export async function crear(datos) {
  const existeEmail = await prisma.usuario.findUnique({ where: { email: datos.email } });
  if (existeEmail) throw new ConflictError('Email ya en uso');

  const existeUsername = await prisma.usuario.findUnique({ where: { username: datos.username } });
  if (existeUsername) throw new ConflictError('Nombre de usuario ya en uso');

  const passwordHash = await bcrypt.hash(datos.password, BCRYPT_COST);

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        username: datos.username,
        email: datos.email,
        passwordHash,
        rol: 'PRODUCTOR',
        activo: true,
        nombre: datos.nombre,
        apellido: datos.apellido,
        telefono: datos.telefono
      }
    });

    const productor = await tx.productor.create({
      data: {
        usuarioId: usuario.id,
        razonSocial: datos.razonSocial,
        cuit: datos.cuit,
        condicionFiscal: datos.condicionFiscal,
        domicilioFiscal: datos.domicilioFiscal,
        localidad: datos.localidad
      }
    });

    return { usuario, productor };
  });
}

export async function actualizar(id, datos, usuarioSolicitante) {
  const productor = await prisma.productor.findUnique({ where: { id } });
  if (!productor) throw new NotFoundError('Productor');

  if (usuarioSolicitante.rol !== 'ADMIN' && usuarioSolicitante.id !== productor.usuarioId) {
    throw new ForbiddenError();
  }

  return prisma.productor.update({
    where: { id },
    data: {
      razonSocial: datos.razonSocial,
      cuit: datos.cuit,
      condicionFiscal: datos.condicionFiscal,
      domicilioFiscal: datos.domicilioFiscal,
      localidad: datos.localidad
    }
  });
}

