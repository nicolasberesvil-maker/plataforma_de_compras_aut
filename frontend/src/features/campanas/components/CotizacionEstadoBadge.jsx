const ESTILOS = {
  SIN_COTIZAR: 'bg-rose-100 text-rose-800',
  COTIZADO: 'bg-sky-100 text-sky-800',
  ADJUDICADO: 'bg-emerald-100 text-emerald-800'
};

const ETIQUETAS = {
  SIN_COTIZAR: 'Sin cotizar',
  COTIZADO: 'Cotizado',
  ADJUDICADO: 'Adjudicado'
};

/**
 * Deriva un estado de cotización explícito a partir de Campana.estado + si
 * ya tiene o no cotizaciones cargadas (M3). No aplica a BORRADOR/ABIERTA
 * (todavía no se armó el RFQ) ni a CANCELADA (ya cubierto por EstadoBadge).
 */
export function derivarEstadoCotizacion(campana) {
  if (campana.estado === 'ADJUDICADA' || campana.estado === 'CERRADA') return 'ADJUDICADO';
  if (campana.estado === 'EN_LICITACION') {
    return (campana._count?.cotizaciones ?? 0) > 0 ? 'COTIZADO' : 'SIN_COTIZAR';
  }
  return null;
}

export function CotizacionEstadoBadge({ campana }) {
  const estado = derivarEstadoCotizacion(campana);
  if (!estado) return null;

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ESTILOS[estado]}`}>
      {ETIQUETAS[estado]}
    </span>
  );
}
