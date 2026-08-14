import { EstadoPedidoBadge } from './EstadoPedidoBadge';

function formatearMoneda(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

const ETIQUETA_MODALIDAD = {
  RETIRO_EN_DEPOSITO: 'Retiro en depósito',
  ENTREGA_EN_CAMPO: 'Entrega en campo'
};

export function ResumenPedidosTable({ rows, mostrarProductor = false }) {
  if (!rows.length) {
    return <p className="text-gray-500 text-sm">No hay pedidos que coincidan con la búsqueda.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((fila) => (
        <div key={`${fila.origen}-${fila.id}`} className="bg-white border rounded-lg p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate">{fila.producto.nombre}</p>
              {mostrarProductor && (
                <p className="text-sm text-gray-600 truncate">{fila.productor.razonSocial} — CUIT {fila.productor.cuit}</p>
              )}
            </div>
            <EstadoPedidoBadge estado={fila.estadoPedido} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span>{fila.volumen.toLocaleString('es-AR')} {fila.producto.unidadMedida?.toLowerCase()}</span>
            {fila.lote ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">Lote: {fila.lote.nombre}</span>
            ) : (
              <span className="text-xs text-gray-400">Individual</span>
            )}
            {fila.formaPago && <span>Pago: {fila.formaPago}</span>}
          </div>

          {fila.entrega && (
            <div className="text-sm text-gray-600">
              <span className="text-gray-500">Entrega: </span>
              {ETIQUETA_MODALIDAD[fila.entrega.modalidad] ?? fila.entrega.modalidad}
              {fila.entrega.deposito && ` — ${fila.entrega.deposito.nombre}, ${fila.entrega.deposito.localidad}`}
              {fila.entrega.direccionCampo && ` — ${fila.entrega.direccionCampo}`}
              {' '}({fila.entrega.estado})
            </div>
          )}

          {fila.pago && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span><span className="text-gray-500">Total: </span>{formatearMoneda(fila.pago.total)}</span>
              {fila.pago.montoPendiente > 0 && (
                <span className="text-aut-naranja">Pendiente: {formatearMoneda(fila.pago.montoPendiente)}</span>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400">{new Date(fila.fecha).toLocaleDateString('es-AR')}</p>
        </div>
      ))}
    </div>
  );
}
