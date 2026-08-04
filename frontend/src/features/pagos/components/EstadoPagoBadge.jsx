const ESTADO_STYLES = {
  DECLARADO: 'bg-amber-100 text-amber-800',
  CONFIRMADO: 'bg-emerald-100 text-emerald-800',
  RECHAZADO: 'bg-red-100 text-red-800'
};

const ESTADO_LABELS = {
  DECLARADO: 'Declarado',
  CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado'
};

export function EstadoPagoBadge({ estado }) {
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${ESTADO_STYLES[estado] ?? ''}`}>
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}
