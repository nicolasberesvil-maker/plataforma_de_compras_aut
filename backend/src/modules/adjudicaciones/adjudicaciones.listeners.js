import { eventBus } from '../../services/event-bus.service.js';
import * as adjudicacionesService from './adjudicaciones.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Registra los listeners que materializan una adjudicación a partir de
 * eventos de negocio. Se llama una sola vez al iniciar la app.
 */
export function registrarListenersAdjudicaciones() {
  eventBus.on('COMPRA_DIRECTA_ADJUDICADA', onCompraDirectaAdjudicada);
  logger.info('Listeners de adjudicaciones registrados');
}

async function onCompraDirectaAdjudicada(payload) {
  try {
    await adjudicacionesService.procesarAdjudicacionDirecta(payload);
  } catch (err) {
    logger.error({ err, campanaId: payload.campanaId }, 'Error materializando adjudicación directa');
  }
}
