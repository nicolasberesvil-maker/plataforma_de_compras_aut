const COLORES = {
  SUELTO_PENDIENTE: 'bg-gray-100 text-gray-800',
  AGRUPADA: 'bg-sky-100 text-sky-800',
  EN_LICITACION: 'bg-amber-100 text-amber-800',
  ORDEN_PENDIENTE: 'bg-yellow-100 text-yellow-800',
  ORDEN_PARCIAL: 'bg-sky-100 text-sky-800',
  ORDEN_PAGADO: 'bg-green-100 text-green-800',
  ORDEN_VENCIDO: 'bg-rose-100 text-rose-800',
  ORDEN_CANCELADO: 'bg-gray-200 text-gray-700'
};

const ETIQUETAS = {
  SUELTO_PENDIENTE: 'Pedido suelto',
  AGRUPADA: 'Agrupado',
  EN_LICITACION: 'En licitación',
  ORDEN_PENDIENTE: 'Orden — pago pendiente',
  ORDEN_PARCIAL: 'Orden — pago parcial',
  ORDEN_PAGADO: 'Orden — pagado',
  ORDEN_VENCIDO: 'Orden — vencido',
  ORDEN_CANCELADO: 'Orden — cancelado'
};

export function EstadoPedidoBadge({ estado }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${COLORES[estado] ?? 'bg-gray-100 text-gray-800'}`}>
      {ETIQUETAS[estado] ?? estado}
    </span>
  );
}
