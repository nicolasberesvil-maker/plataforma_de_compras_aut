import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { entregasApi } from '../api/entregas.api';
import { EstadoEntregaBadge } from './EstadoEntregaBadge';

export function EntregaCard({ entrega }) {
  const producto = entrega.ordenCompra?.adjudicacion?.campana?.producto;
  const queryClient = useQueryClient();

  const confirmar = useMutation({
    mutationFn: () => entregasApi.confirmarEntregaCampo(entrega.id, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] })
  });

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

      {confirmar.isError && (
        <p className="text-red-600 text-sm">
          {confirmar.error.response?.data?.error?.message || 'No se pudo confirmar la recepción'}
        </p>
      )}

      {/* Botón del productor (regla D.5): cuando el proveedor entrega directo
          en el campo, AUT no está presente — confirma quien recibió. */}
      {entrega.modalidad === 'ENTREGA_EN_CAMPO' && ['EN_TRANSITO', 'EN_RUTA_A_CAMPO'].includes(entrega.estado) && (
        <button
          onClick={() => confirmar.mutate()}
          disabled={confirmar.isPending}
          className="w-full bg-aut-verde text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {confirmar.isPending ? 'Confirmando...' : '✓ Confirmé que recibí mi pedido'}
        </button>
      )}
    </div>
  );
}
