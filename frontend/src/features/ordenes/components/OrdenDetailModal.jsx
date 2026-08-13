import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../../components/Modal';
import { ordenesApi } from '../api/ordenes.api';
import { EstadoPagoOrdenBadge } from './EstadoPagoOrdenBadge';
import { EstadoEntregaBadge } from '../../entregas/components/EstadoEntregaBadge';

function formatearMoneda(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

export function OrdenDetailModal({ ordenId, mostrarProductor = false, onCerrar }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ordenes', ordenId],
    queryFn: () => ordenesApi.obtener(ordenId)
  });

  const orden = data?.orden;
  const campana = orden?.adjudicacion?.campana;
  const cotizacion = orden?.adjudicacion?.cotizacionGanadora;
  const entrega = orden?.entrega;
  const porcentajeAhorro = orden?.porcentajeAhorro ? Number(orden.porcentajeAhorro) : null;

  return (
    <Modal titulo={campana?.producto?.nombre ?? 'Detalle de la compra'} onCerrar={onCerrar}>
      {isLoading || !orden ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Estado de pago</span>
            <EstadoPagoOrdenBadge estado={orden.estadoPago} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-500 text-xs">Pedido de cotización</p>
              <p className="font-medium">{campana?.nombre}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Compra confirmada el</p>
              <p className="font-medium">{new Date(orden.createdAt).toLocaleDateString('es-AR')}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Volumen</p>
              <p className="font-medium">{Number(orden.volumenFinal)} {campana?.producto?.unidadMedida?.toLowerCase()}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Precio unitario</p>
              <p className="font-medium">{formatearMoneda(Number(orden.precioUnitario))}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Total</p>
              <p className="font-medium">{formatearMoneda(Number(orden.total))}</p>
            </div>
            {mostrarProductor && orden.productor && (
              <div>
                <p className="text-gray-500 text-xs">Comprador</p>
                <p className="font-medium">{orden.productor.razonSocial}</p>
              </div>
            )}
          </div>

          {porcentajeAhorro != null && (
            <p className="text-aut-verde font-medium">Ahorraste un {porcentajeAhorro.toFixed(1)}% comprando en grupo</p>
          )}

          {cotizacion && (
            <div className="border-t pt-3 space-y-1">
              <p className="font-medium text-gray-700">Condiciones del proveedor</p>
              <p><span className="text-gray-500">Forma de pago: </span>{cotizacion.condicionesPago}</p>
              <p><span className="text-gray-500">Plazo de entrega: </span>{cotizacion.plazoEntregaDias} días</p>
            </div>
          )}

          {entrega && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-700">Entrega</p>
                <EstadoEntregaBadge estado={entrega.estado} />
              </div>
              <p>
                <span className="text-gray-500">Modalidad: </span>
                {entrega.modalidad === 'RETIRO_EN_DEPOSITO' ? 'Retiro en depósito de AUT' : 'Entrega en campo'}
              </p>
              {entrega.direccionCampo && (
                <p><span className="text-gray-500">Dirección: </span>{entrega.direccionCampo}</p>
              )}
              {entrega.deposito && (
                <p><span className="text-gray-500">Depósito: </span>{entrega.deposito.nombre}, {entrega.deposito.direccion}, {entrega.deposito.localidad}</p>
              )}
              {entrega.fechaEntregadaAt && (
                <p><span className="text-gray-500">Entregada el: </span>{new Date(entrega.fechaEntregadaAt).toLocaleDateString('es-AR')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
