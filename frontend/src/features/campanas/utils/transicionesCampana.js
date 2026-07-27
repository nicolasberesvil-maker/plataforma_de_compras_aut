// Mismo mapa que backend/src/utils/transiciones-campana.js — así el admin
// nunca ve una acción inválida (ej. "Enviar a licitación" en una DIRECTA).
const TRANSICIONES_CAMPANA = {
  COLECTIVA: {
    BORRADOR: ['ABIERTA', 'CANCELADA'],
    ABIERTA: ['EN_LICITACION', 'CANCELADA'],
    EN_LICITACION: ['ADJUDICADA', 'CANCELADA'],
    ADJUDICADA: ['CERRADA'],
    CERRADA: [],
    CANCELADA: []
  },
  DIRECTA: {
    BORRADOR: ['ABIERTA', 'ADJUDICADA', 'CANCELADA'],
    ABIERTA: ['ADJUDICADA', 'CANCELADA'],
    ADJUDICADA: ['CERRADA'],
    CERRADA: [],
    CANCELADA: []
  },
  CONTINUA: {
    BORRADOR: ['ABIERTA', 'CANCELADA'],
    ABIERTA: ['CANCELADA'],
    CERRADA: [],
    CANCELADA: []
  }
};

export function transicionesDisponibles(tipo, estadoActual) {
  return TRANSICIONES_CAMPANA[tipo]?.[estadoActual] ?? [];
}
