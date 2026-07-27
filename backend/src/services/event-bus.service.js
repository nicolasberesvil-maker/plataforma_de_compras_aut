import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

/**
 * Bus de eventos central del sistema.
 * Se exporta una instancia única (singleton).
 * Los listeners se registran al iniciar la app (server.js).
 */
class AppEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // suficiente para v1
  }

  // Wrapper que loguea cada emit para debugging.
  emit(event, payload) {
    logger.info({ event, payload }, 'Event emitted');
    return super.emit(event, payload);
  }
}

export const eventBus = new AppEventBus();
