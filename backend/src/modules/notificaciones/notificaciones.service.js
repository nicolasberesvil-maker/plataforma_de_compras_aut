import { prisma } from '../../config/database.js';
import { emailService } from '../../services/email.service.js';
import { socketService } from '../../services/socket.service.js';
import { NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * Crea una notificación (fuente de verdad en BD) y la envía por los canales
 * habilitados. Email y socket son fire-and-forget: si fallan, la notificación
 * sigue existiendo en la campanita (regla de oro, ver 04-NOTIFICACIONES.md).
 */
export async function crearYEnviar({ usuarioId, tipo, titulo, mensaje, enlaceRelativo, metadatos }) {
  const notificacion = await prisma.notificacion.create({
    data: { usuarioId, tipo, titulo, mensaje, enlaceRelativo, metadatos }
  });

  enviarPorCanales(notificacion).catch((err) => {
    logger.error({ err, notificacionId: notificacion.id }, 'Error enviando notificación');
  });

  return notificacion;
}

async function enviarPorCanales(notificacion) {
  socketService.emitirANotificacion(notificacion.usuarioId, {
    id: notificacion.id,
    tipo: notificacion.tipo,
    titulo: notificacion.titulo,
    mensaje: notificacion.mensaje,
    enlace: notificacion.enlaceRelativo,
    createdAt: notificacion.createdAt
  });

  const usuario = await prisma.usuario.findUnique({ where: { id: notificacion.usuarioId } });
  if (!usuario?.email) return;

  // Si no existe la plantilla del tipo (todavía no se creó en esta fase),
  // renderizarPlantilla tira y queda logueado arriba: no rompe el flujo.
  await emailService.enviarPlantilla({
    to: usuario.email,
    template: notificacion.tipo.toLowerCase(),
    variables: {
      nombre: usuario.nombre,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      enlace: notificacion.enlaceRelativo ? `${process.env.FRONTEND_URL}${notificacion.enlaceRelativo}` : ''
    }
  });
}

export async function marcarComoLeida(id, usuarioId) {
  const notificacion = await prisma.notificacion.findUnique({ where: { id } });
  if (!notificacion || notificacion.usuarioId !== usuarioId) throw new NotFoundError('Notificación');

  return prisma.notificacion.update({
    where: { id },
    data: { leida: true, leidaAt: new Date() }
  });
}

export async function listarPorUsuario(usuarioId, { soloNoLeidas, page = 1, limit = 20 } = {}) {
  const where = { usuarioId };
  if (soloNoLeidas) where.leida = false;

  const [data, total] = await Promise.all([
    prisma.notificacion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit
    }),
    prisma.notificacion.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function contarNoLeidas(usuarioId) {
  return prisma.notificacion.count({ where: { usuarioId, leida: false } });
}
