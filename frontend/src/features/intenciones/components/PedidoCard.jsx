import { useState } from 'react';
import { PedidoDetailModal } from './PedidoDetailModal';

const ESTADO_STYLE = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  AGRUPADA: 'bg-sky-100 text-sky-800',
  DESCARTADA: 'bg-red-100 text-red-800'
};

export function PedidoCard({ pedido }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const producto = pedido.campana?.producto ?? pedido.producto;

  return (
    <>
      <button
        onClick={() => setModalAbierto(true)}
        className="w-full text-left bg-white border rounded-lg p-4 space-y-2 active:bg-gray-50"
      >
        <div className="flex items-center justify-between">
          <p className="font-medium">{producto?.nombre}</p>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_STYLE[pedido.estado]}`}>
            {pedido.estado}
          </span>
        </div>
        <p className="text-sm text-gray-600">
          {Number(pedido.volumen)} {producto?.unidadMedida?.toLowerCase()}
        </p>
        {pedido.campanaId ? (
          <p className="text-aut-verde text-sm font-medium">Ver pedido de cotización →</p>
        ) : (
          <p className="text-xs text-gray-500">Pedido suelto, todavía sin pedido de cotización asignado.</p>
        )}
        {pedido.estado === 'DESCARTADA' && pedido.motivoDescarte && (
          <p className="text-xs text-red-700">Motivo: {pedido.motivoDescarte}</p>
        )}
      </button>

      {modalAbierto && <PedidoDetailModal pedido={pedido} onCerrar={() => setModalAbierto(false)} />}
    </>
  );
}
