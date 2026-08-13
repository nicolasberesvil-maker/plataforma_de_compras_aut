import { useState } from 'react';
import { EstadoPagoOrdenBadge } from './EstadoPagoOrdenBadge';
import { OrdenDetailModal } from './OrdenDetailModal';

export function OrdenCard({ orden, mostrarProductor = false }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const campana = orden.adjudicacion?.campana;
  const porcentajeAhorro = orden.porcentajeAhorro ? Number(orden.porcentajeAhorro) : null;

  return (
    <>
      <button
        onClick={() => setModalAbierto(true)}
        className="w-full text-left bg-white border rounded-lg p-4 space-y-2 active:bg-gray-50"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">{campana?.producto?.nombre}</p>
            <p className="text-sm text-gray-600">{campana?.nombre}</p>
            {mostrarProductor && orden.productor && (
              <p className="text-xs text-gray-500">Comprador: {orden.productor.razonSocial}</p>
            )}
          </div>
          <EstadoPagoOrdenBadge estado={orden.estadoPago} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">Volumen: </span>{Number(orden.volumenFinal)}</div>
          <div><span className="text-gray-500">Precio unit.: </span>${Number(orden.precioUnitario).toFixed(2)}</div>
          <div><span className="text-gray-500">Total: </span>${Number(orden.total).toFixed(2)}</div>
          {orden.entrega && <div><span className="text-gray-500">Entrega: </span>{orden.entrega.estado}</div>}
        </div>

        {!mostrarProductor && porcentajeAhorro != null && (
          <p className="text-sm text-aut-verde font-medium">
            Ahorraste un {porcentajeAhorro.toFixed(1)}% comprando en grupo
          </p>
        )}
      </button>

      {modalAbierto && (
        <OrdenDetailModal ordenId={orden.id} mostrarProductor={mostrarProductor} onCerrar={() => setModalAbierto(false)} />
      )}
    </>
  );
}
