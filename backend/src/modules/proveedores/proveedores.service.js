import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';

const BCRYPT_COST = 12;

export async function listar({ estadoAprobacion, search, page = 1, limit = 20 }) {
  const where = {};
  if (estadoAprobacion) where.estadoAprobacion = estadoAprobacion;
  if (search) {
    where.OR = [
      { razonSocial: { contains: search } },
      { cuit: { contains: search } }
    ];
  }

  const [data, total] = await Promise.all([
    prisma.proveedor.findMany({
      where,
      include: { usuario: { select: { email: true, nombre: true, apellido: true, activo: true } } },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.proveedor.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// Usado por el módulo de notificaciones (avisos masivos al abrirse una licitación).
export async function listarAprobados() {
  return prisma.proveedor.findMany({
    where: { estadoAprobacion: 'APROBADO', usuario: { activo: true } },
    include: { usuario: true }
  });
}

export async function obtenerPorId(id, usuarioSolicitante) {
  const proveedor = await prisma.proveedor.findUnique({
    where: { id },
    include: { usuario: true }
  });
  if (!proveedor) throw new NotFoundError('Proveedor');

  if (usuarioSolicitante && !['ADMIN', 'CONTADOR'].includes(usuarioSolicitante.rol) && usuarioSolicitante.id !== proveedor.usuarioId) {
    throw new ForbiddenError('Solo podés ver tus propios datos');
  }

  return proveedor;
}

/**
 * Alta manual de proveedor por ADMIN. Crea Usuario + Proveedor en una
 * transacción y genera una password temporal (régimen cerrado, regla C.4:
 * los proveedores no se autoregistran).
 */
export async function crear(datos) {
  const existe = await prisma.usuario.findUnique({ where: { email: datos.email } });
  if (existe) throw new ConflictError('Email ya en uso');

  const passwordTemporal = crypto.randomBytes(8).toString('hex');
  const passwordHash = await bcrypt.hash(passwordTemporal, BCRYPT_COST);

  const resultado = await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email: datos.email,
        passwordHash,
        rol: 'PROVEEDOR',
        activo: true,
        nombre: datos.nombre,
        apellido: datos.apellido,
        telefono: datos.telefono
      }
    });

    const proveedor = await tx.proveedor.create({
      data: {
        usuarioId: usuario.id,
        razonSocial: datos.razonSocial,
        cuit: datos.cuit,
        condicionFiscal: datos.condicionFiscal,
        domicilioFiscal: datos.domicilioFiscal,
        notasInternas: datos.notasInternas,
        estadoAprobacion: 'APROBADO' // Si lo crea admin, ya está aprobado
      }
    });

    return { usuario, proveedor };
  });

  // TODO(nicolas, 2026-07): enviar email al proveedor con `passwordTemporal`
  // cuando el servicio de email esté disponible (transversal, se activa en Fase 4).

  return { ...resultado, passwordTemporal };
}

export async function actualizar(id, datos) {
  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor) throw new NotFoundError('Proveedor');

  return prisma.proveedor.update({
    where: { id },
    data: {
      razonSocial: datos.razonSocial,
      cuit: datos.cuit,
      condicionFiscal: datos.condicionFiscal,
      domicilioFiscal: datos.domicilioFiscal,
      notasInternas: datos.notasInternas
    }
  });
}

export async function aprobar(id) {
  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor) throw new NotFoundError('Proveedor');
  if (proveedor.estadoAprobacion === 'APROBADO') throw new ConflictError('Proveedor ya aprobado');

  const actualizado = await prisma.proveedor.update({
    where: { id },
    data: { estadoAprobacion: 'APROBADO' }
  });

  eventBus.emit('PROVEEDOR_APROBADO', { proveedorId: id });

  return actualizado;
}

export async function suspender(id) {
  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor) throw new NotFoundError('Proveedor');

  return prisma.proveedor.update({
    where: { id },
    data: { estadoAprobacion: 'SUSPENDIDO' }
  });
}
