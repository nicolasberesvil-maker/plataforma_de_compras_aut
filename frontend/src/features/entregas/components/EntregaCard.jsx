import { Link } from 'react-router-dom';
import { EstadoEntregaBadge } from './EstadoEntregaBadge';

export function EntregaCard({ entrega }) {
  const producto = entrega.ordenCompra?.adjudicacion?.campana?.producto;

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <Link to={`/productor/entregas/${entrega.id}`} className="font-semibold text-aut-verde">
            {producto?.nombre}
          </Link>
          <p className="text-sm text-gray-600">
            {Number(entrega.ordenCompra?.volumenFinal)} {producto?.unidadMedida}
          </p>
        </div>
        <EstadoEntregaBadge estado={entrega.estado} />
      </div>

      {entrega.modalidad === 'RETIRO_EN_DEPOSITO' && entrega.deposito && (
        <div className="bg-blue-50 p-3 rounded text-sm">
          <p className="font-medium">📍 Retirar en: {entrega.deposito.nombre}</p>
          <p>{entrega.deposito.direccion}, {entrega.deposito.localidad}</p>
          {entrega.deposito.horarioAtencion && <p className="text-gray-600 mt-1">🕐 {entrega.deposito.horarioAtencion}</p>}
          {entrega.deposito.responsable && <p className="text-gray-600">👤 {entrega.deposito.responsable}</p>}
        </div>
      )}

      {entrega.estado === 'DISPONIBLE_PARA_RETIRO' && (
        <div className="p-2 bg-green-100 text-green-800 rounded text-sm text-center font-medium">
          ✓ Listo para retirar
        </div>
      )}

      {entrega.modalidad === 'ENTREGA_EN_CAMPO' && ['EN_TRANSITO', 'EN_RUTA_A_CAMPO'].includes(entrega.estado) && (
        <p className="text-sm text-gray-500 text-center">
          El proveedor va a marcar la entrega como recibida cuando la complete.
        </p>
      )}
    </div>
  );
}
