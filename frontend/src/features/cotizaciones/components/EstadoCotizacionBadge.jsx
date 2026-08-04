const ESTILOS = {
  COTIZADA: 'bg-sky-100 text-sky-800',
  APROBADA: 'bg-emerald-100 text-emerald-800',
  RECHAZADA: 'bg-gray-100 text-gray-600',
  CANCELADA: 'bg-gray-100 text-gray-600'
};

const ETIQUETAS = {
  COTIZADA: 'Cotizada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada'
};

/** Estado de la cotización desde el punto de vista del proveedor: todavía en juego, ganó o perdió. */
export function derivarEstadoCotizacion(cotizacion) {
  const estadoCampana = cotizacion.campana?.estado;
  if (estadoCampana === 'CANCELADA') return 'CANCELADA';
  if (estadoCampana === 'ADJUDICADA' || estadoCampana === 'CERRADA') {
    return cotizacion.esGanadora ? 'APROBADA' : 'RECHAZADA';
  }
  return 'COTIZADA';
}

export function EstadoCotizacionBadge({ cotizacion }) {
  const estado = derivarEstadoCotizacion(cotizacion);
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ESTILOS[estado]}`}>
      {ETIQUETAS[estado]}
    </span>
  );
}
