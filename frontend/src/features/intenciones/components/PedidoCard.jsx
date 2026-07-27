import { Link } from 'react-router-dom';

const ESTADO_STYLE = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  AGRUPADA: 'bg-sky-100 text-sky-800',
  DESCARTADA: 'bg-red-100 text-red-800'
};

export function PedidoCard({ pedido }) {
  const producto = pedido.campana?.producto ?? pedido.producto;

  return (
    <div className="bg-white border rounded-lg p-4 space-y-2">
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
        <Link to={`/productor/campanas/${pedido.campanaId}`} className="text-aut-verde text-sm font-medium">
          Ver campaña →
        </Link>
      ) : (
        <p className="text-xs text-gray-500">Pedido suelto, todavía sin campaña asignada.</p>
      )}
      {pedido.estado === 'DESCARTADA' && pedido.motivoDescarte && (
        <p className="text-xs text-red-700">Motivo: {pedido.motivoDescarte}</p>
      )}
    </div>
  );
}
