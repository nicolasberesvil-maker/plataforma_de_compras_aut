const ESTADO_PAGO_STYLES = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  PARCIAL: 'bg-sky-100 text-sky-800',
  PAGADO: 'bg-green-100 text-green-800',
  VENCIDO: 'bg-red-100 text-red-800',
  CANCELADO: 'bg-gray-100 text-gray-600'
};

export function OrdenCard({ orden, mostrarProductor = false }) {
  const campana = orden.adjudicacion?.campana;
  const porcentajeAhorro = orden.porcentajeAhorro ? Number(orden.porcentajeAhorro) : null;

  return (
    <div className="bg-white border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{campana?.producto?.nombre}</p>
          <p className="text-sm text-gray-600">{campana?.nombre}</p>
          {mostrarProductor && orden.productor && (
            <p className="text-xs text-gray-500">Comprador: {orden.productor.razonSocial}</p>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${ESTADO_PAGO_STYLES[orden.estadoPago] ?? ''}`}>
          {orden.estadoPago}
        </span>
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
    </div>
  );
}
