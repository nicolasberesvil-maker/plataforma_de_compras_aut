import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';

export async function listar({ aprobado, search, page = 1, limit = 20 }) {
  const where = {};
  if (aprobado !== undefined) where.aprobado = aprobado;
  if (search) {
    where.OR = [
      { razonSocial: { contains: search } },
      { cuit: { contains: search } }
    ];
  }

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

export async function listarPendientes() {
  return prisma.productor.findMany({
    where: { aprobado: false },
    include: { usuario: { select: { email: true, nombre: true, apellido: true, telefono: true } } },
    orderBy: { createdAt: 'asc' }
  });
}

// Usado por el módulo de notificaciones (avisos masivos a productores activos).
export async function listarAprobados() {
  return prisma.productor.findMany({
    where: { aprobado: true, usuario: { activo: true } },
    include: { usuario: true }
  });
}

export async function obtenerPorId(id, usuarioSolicitante) {
  const productor = await prisma.productor.findUnique({
    where: { id },
    include: { usuario: true }
  });
  if (!productor) throw new NotFoundError('Productor');

  if (usuarioSolicitante && !['ADMIN', 'CONTADOR'].includes(usuarioSolicitante.rol) && usuarioSolicitante.id !== productor.usuarioId) {
    throw new ForbiddenError('Solo podés ver tus propios datos');
  }

  return productor;
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

export async function aprobar(id) {
  const productor = await prisma.productor.findUnique({ where: { id }, include: { usuario: true } });
  if (!productor) throw new NotFoundError('Productor');
  if (productor.aprobado) throw new ConflictError('Productor ya aprobado');

  // Transacción: aprobar productor + activar usuario
  const resultado = await prisma.$transaction(async (tx) => {
    const p = await tx.productor.update({
      where: { id },
      data: { aprobado: true, aprobadoAt: new Date() }
    });
    await tx.usuario.update({
      where: { id: productor.usuarioId },
      data: { activo: true }
    });
    return p;
  });

  eventBus.emit('PRODUCTOR_APROBADO', {
    productorId: id,
    usuarioId: productor.usuarioId
  });

  return resultado;
}

export async function rechazar(id, motivo) {
  const productor = await prisma.productor.findUnique({ where: { id } });
  if (!productor) throw new NotFoundError('Productor');
  if (productor.aprobado) throw new ConflictError('Productor ya aprobado, no se puede rechazar');

  await prisma.usuario.update({
    where: { id: productor.usuarioId },
    data: { activo: false }
  });

  // TODO(nicolas, 2026-07): no hay evento PRODUCTOR_RECHAZADO documentado en
  // 04-NOTIFICACIONES.md. Notificar al productor con `motivo` queda pendiente
  // hasta que se defina el catálogo de eventos de rechazo.
  return motivo;
}
