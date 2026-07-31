export const TRANSICIONES_ENTREGA = {
  PENDIENTE:              ['EN_TRANSITO', 'DISPONIBLE_PARA_RETIRO', 'CANCELADA'],
  // ENTREGADA está acá (y no solo en EN_RUTA_A_CAMPO) porque la entrega en
  // campo puede confirmarse directo desde EN_TRANSITO: EN_RUTA_A_CAMPO es un
  // estado intermedio opcional, no todos los operadores lo cargan.
  EN_TRANSITO:            ['DISPONIBLE_PARA_RETIRO', 'EN_RUTA_A_CAMPO', 'ENTREGADA', 'CANCELADA'],
  DISPONIBLE_PARA_RETIRO: ['ENTREGADA', 'CANCELADA'],
  EN_RUTA_A_CAMPO:        ['ENTREGADA', 'CANCELADA'],
  ENTREGADA:              [],
  CANCELADA:              []
};

export function puedeTransicionar(estadoActual, estadoNuevo) {
  return TRANSICIONES_ENTREGA[estadoActual]?.includes(estadoNuevo) ?? false;
}
