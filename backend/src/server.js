import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { registrarListenersNotificaciones } from './modules/notificaciones/notificaciones.listeners.js';
import { registrarListenersAdjudicaciones } from './modules/adjudicaciones/adjudicaciones.listeners.js';
import { iniciarJobs } from './jobs/index.js';
import { socketService } from './services/socket.service.js';

const httpServer = http.createServer(app);

registrarListenersNotificaciones();
registrarListenersAdjudicaciones();

socketService.iniciar(httpServer);
iniciarJobs();

httpServer.listen(env.PORT, () => {
  logger.info(`Backend escuchando en puerto ${env.PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido, cerrando servidor');
  httpServer.close(() => process.exit(0));
});
