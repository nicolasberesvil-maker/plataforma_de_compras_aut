/**
 * Mapa de transiciones válidas por TIPO de compra.
 * Si un estado origen no tiene transición a un estado destino para ese tipo,
 * la transición no se permite (el service lanza 409).
 */
export const TRANSICIONES_CAMPANA = {
  // Caso insignia: agrupa volumen y licita antes de adjudicar.
  COLECTIVA: {
    BORRADOR: ['ABIERTA', 'CANCELADA'],
    ABIERTA: ['EN_LICITACION', 'CANCELADA'],
    EN_LICITACION: ['ADJUDICADA', 'CANCELADA'],
    ADJUDICADA: ['CERRADA'],
    CERRADA: [],
    CANCELADA: []
  },
  // Compra puntual: proveedor y precio ya conocidos, se adjudica sin licitar.
  // Puede saltar ABIERTA (BORRADOR → ADJUDICADA) para el caso más rápido.
  DIRECTA: {
    BORRADOR: ['ABIERTA', 'ADJUDICADA', 'CANCELADA'],
    ABIERTA: ['ADJUDICADA', 'CANCELADA'],
    ADJUDICADA: ['CERRADA'],
    CERRADA: [],
    CANCELADA: []
  },
  // Proceso permanente: no se cierra por fecha ni se adjudica a sí mismo;
  // genera tandas hijas. Solo se puede cancelar (dar de baja el proceso).
  CONTINUA: {
    BORRADOR: ['ABIERTA', 'CANCELADA'],
    ABIERTA: ['CANCELADA'],
    CERRADA: [],
    CANCELADA: []
  }
};

export function puedeTransicionar(tipo, estadoActual, estadoNuevo) {
  return TRANSICIONES_CAMPANA[tipo]?.[estadoActual]?.includes(estadoNuevo) ?? false;
}

export function transicionesDisponibles(tipo, estadoActual) {
  return TRANSICIONES_CAMPANA[tipo]?.[estadoActual] ?? [];
}
