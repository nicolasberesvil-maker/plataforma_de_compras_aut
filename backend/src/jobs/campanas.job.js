import cron from 'node-cron';
import { prisma } from '../config/database.js';
import * as campanaService from '../modules/campanas/campanas.service.js';
import { eventBus } from '../services/event-bus.service.js';
import { logger } from '../utils/logger.js';

/**
 * Cada hora: cierra campañas que ya vencieron su fechaCierre.
 */
export function iniciarJobCierreAutomatico() {
  cron.schedule('0 * * * *', async () => {
    logger.info('Job: cierre automático de campañas');

    // Solo COLECTIVA cierra por fecha. CONTINUA queda ABIERTA con fechaCierre
    // null (ya excluida por el filtro), y DIRECTA no pasa por ABIERTA con fecha.
    const vencidas = await prisma.campana.findMany({
      where: { tipo: 'COLECTIVA', estado: 'ABIERTA', fechaCierre: { lt: new Date() } }
    });

    for (const campana of vencidas) {
      try {
        await campanaService.cerrarIntenciones(campana.id, { motivo: 'Cierre automático por vencimiento' });
        logger.info({ campanaId: campana.id }, 'Campaña cerrada automáticamente');
      } catch (err) {
        logger.error({ err, campanaId: campana.id }, 'Error en cierre automático');
      }
    }
  });
}

/**
 * Diario a las 9:00 AM: avisa a productores 48 hs antes del cierre.
 */
export function iniciarJobRecordatorioCierre() {
  cron.schedule('0 9 * * *', async () => {
    logger.info('Job: recordatorios 48 hs');

    const en24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const en48h = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const proximas = await prisma.campana.findMany({
      where: { tipo: 'COLECTIVA', estado: 'ABIERTA', fechaCierre: { gt: en24h, lt: en48h } }
    });

    for (const campana of proximas) {
      eventBus.emit('CAMPANA_PROXIMA_A_CERRAR', { campanaId: campana.id });
    }
  });
}
