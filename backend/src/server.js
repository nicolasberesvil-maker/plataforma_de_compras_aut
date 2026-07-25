import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
// import { socketService } from './services/socket.service.js';
// import { iniciarJobs } from './jobs/index.js';

const httpServer = http.createServer(app);

// socketService.iniciar(httpServer);  // se activa en Fase 5 cuando empiezan notif
// iniciarJobs();                       // se activa en Fase 4 con cron de campañas

httpServer.listen(env.PORT, () => {
  logger.info(`Backend escuchando en puerto ${env.PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido, cerrando servidor');
  httpServer.close(() => process.exit(0));
});
