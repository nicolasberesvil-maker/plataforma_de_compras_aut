import { Link } from 'react-router-dom';
import { Modal } from '../../../components/Modal';
import { LABEL_FORMA_PAGO } from '../formasPago';

const ESTADO_STYLE = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  AGRUPADA: 'bg-sky-100 text-sky-800',
  DESCARTADA: 'bg-red-100 text-red-800'
};

const ESTADO_LABEL = {
  PENDIENTE: 'Pendiente',
  AGRUPADA: 'Agrupado en pedido de cotización',
  DESCARTADA: 'Descartado'
};

const MODALIDAD_LABEL = {
  RETIRO_EN_DEPOSITO: 'Retiro en depósito de AUT',
  ENTREGA_EN_CAMPO: 'Entrega en mi campo'
};

export function PedidoDetailModal({ pedido, onCerrar }) {
  const producto = pedido.campana?.producto ?? pedido.producto;

  return (
    <Modal titulo={producto?.nombre ?? 'Detalle del pedido'} onCerrar={onCerrar}>
      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Estado</span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_STYLE[pedido.estado]}`}>
            {ESTADO_LABEL[pedido.estado] ?? pedido.estado}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-gray-500 text-xs">Cantidad pedida</p>
            <p className="font-medium">{Number(pedido.volumen)} {producto?.unidadMedida?.toLowerCase()}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Pedido el</p>
            <p className="font-medium">{new Date(pedido.createdAt).toLocaleDateString('es-AR')}</p>
          </div>
        </div>

        {pedido.fechaDeseada && (
          <div>
            <p className="text-gray-500 text-xs">Para cuándo lo necesitaba</p>
            <p className="font-medium">{new Date(pedido.fechaDeseada).toLocaleDateString('es-AR')}</p>
          </div>
        )}

        {pedido.modalidadEntregaPreferida && (
          <div>
            <p className="text-gray-500 text-xs">Cómo prefiere recibirlo</p>
            <p className="font-medium">{MODALIDAD_LABEL[pedido.modalidadEntregaPreferida] ?? pedido.modalidadEntregaPreferida}</p>
          </div>
        )}

        {pedido.direccionEntregaCampo && (
          <div>
            <p className="text-gray-500 text-xs">Dirección de entrega</p>
            <p className="font-medium">{pedido.direccionEntregaCampo}</p>
          </div>
        )}

        {pedido.formasPagoPreferidas?.length > 0 && (
          <div>
            <p className="text-gray-500 text-xs">Formas de pago preferidas</p>
            <p className="font-medium">
              {pedido.formasPagoPreferidas.map((f) => LABEL_FORMA_PAGO[f] ?? f).join(', ')}
            </p>
          </div>
        )}

        {pedido.observaciones && (
          <div>
            <p className="text-gray-500 text-xs">Observaciones</p>
            <p className="font-medium">{pedido.observaciones}</p>
          </div>
        )}

        {pedido.estado === 'DESCARTADA' && pedido.motivoDescarte && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-xs font-medium">Motivo del descarte</p>
            <p className="text-red-700">{pedido.motivoDescarte}</p>
          </div>
        )}

        {pedido.campanaId ? (
          <Link
            to={`/productor/campanas/${pedido.campanaId}`}
            onClick={onCerrar}
            className="block text-center bg-aut-verde text-white py-3 rounded-lg font-medium"
          >
            Ver pedido de cotización
          </Link>
        ) : (
          <p className="text-xs text-gray-500 text-center">Pedido suelto, todavía sin pedido de cotización asignado.</p>
        )}
      </div>
    </Modal>
  );
}
