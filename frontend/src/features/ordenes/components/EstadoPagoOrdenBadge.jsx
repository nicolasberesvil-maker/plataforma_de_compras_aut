const ESTADO_PAGO_STYLES = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  PARCIAL: 'bg-sky-100 text-sky-800',
  PAGADO: 'bg-green-100 text-green-800',
  VENCIDO: 'bg-red-100 text-red-800',
  CANCELADO: 'bg-gray-100 text-gray-600'
};

export function EstadoPagoOrdenBadge({ estado }) {
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${ESTADO_PAGO_STYLES[estado] ?? ''}`}>
      {estado}
    </span>
  );
}
