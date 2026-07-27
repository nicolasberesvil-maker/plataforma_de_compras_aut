import { Server } from 'socket.io';
import { verifyAccessToken } from '../modules/auth/auth.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

class SocketService {
  constructor() {
    this.io = null;
    // Mapa usuarioId → Set de socket IDs (un usuario puede tener varias pestañas/dispositivos).
    this.conexionesPorUsuario = new Map();
  }

  iniciar(httpServer) {
    this.io = new Server(httpServer, {
      cors: { origin: env.FRONTEND_URL, credentials: true }
    });

    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Sin token'));
        socket.usuarioId = verifyAccessToken(token).usuarioId;
        next();
      } catch {
        next(new Error('Token inválido'));
      }
    });

    this.io.on('connection', (socket) => this.#onConnection(socket));

    logger.info('Socket.io iniciado');
  }

  #onConnection(socket) {
    const { usuarioId } = socket;
    logger.info({ usuarioId, socketId: socket.id }, 'Cliente conectado');

    if (!this.conexionesPorUsuario.has(usuarioId)) {
      this.conexionesPorUsuario.set(usuarioId, new Set());
    }
    this.conexionesPorUsuario.get(usuarioId).add(socket.id);

    socket.on('subscribe:campana', ({ campanaId }) => socket.join(`campana:${campanaId}`));
    socket.on('unsubscribe:campana', ({ campanaId }) => socket.leave(`campana:${campanaId}`));

    socket.on('disconnect', () => {
      const conexiones = this.conexionesPorUsuario.get(usuarioId);
      if (!conexiones) return;
      conexiones.delete(socket.id);
      if (conexiones.size === 0) this.conexionesPorUsuario.delete(usuarioId);
    });
  }

  /** Emite a todas las conexiones activas de un usuario puntual (campanita). */
  emitirANotificacion(usuarioId, notificacion) {
    if (!this.io) return;
    const conexiones = this.conexionesPorUsuario.get(usuarioId);
    if (!conexiones || conexiones.size === 0) return;
    for (const socketId of conexiones) {
      this.io.to(socketId).emit('notificacion:nueva', notificacion);
    }
  }

  /** Emite a todos los suscriptos a una campaña (volumen acumulado en vivo). */
  emitirAlaCampana(campanaId, evento, payload) {
    if (!this.io) return;
    this.io.to(`campana:${campanaId}`).emit(evento, payload);
  }
}

export const socketService = new SocketService();
