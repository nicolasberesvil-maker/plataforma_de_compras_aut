const ESTADO_STYLES = {
  PENDIENTE: 'bg-gray-100 text-gray-700',
  EN_TRANSITO: 'bg-sky-100 text-sky-800',
  DISPONIBLE_PARA_RETIRO: 'bg-green-100 text-green-800',
  EN_RUTA_A_CAMPO: 'bg-sky-100 text-sky-800',
  ENTREGADA: 'bg-emerald-100 text-emerald-800',
  CANCELADA: 'bg-red-100 text-red-800'
};

const ESTADO_LABELS = {
  PENDIENTE: 'Pendiente',
  EN_TRANSITO: 'En tránsito',
  DISPONIBLE_PARA_RETIRO: 'Lista para retirar',
  EN_RUTA_A_CAMPO: 'En ruta a campo',
  ENTREGADA: 'Entregada',
  CANCELADA: 'Cancelada'
};

export function EstadoEntregaBadge({ estado }) {
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${ESTADO_STYLES[estado] ?? ''}`}>
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}
