import { useMutation, useQueryClient } from '@tanstack/react-query';
import { entregasApi } from '../api/entregas.api';
import { EstadoEntregaBadge } from './EstadoEntregaBadge';

export function EntregaProveedorCard({ entrega }) {
  const producto = entrega.ordenCompra?.adjudicacion?.campana?.producto;
  const queryClient = useQueryClient();

  const marcarEnTransito = useMutation({
    mutationFn: () => entregasApi.marcarEnTransito(entrega.id, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] })
  });

  const confirmarEntregado = useMutation({
    mutationFn: () => entregasApi.confirmarEntregaCampo(entrega.id, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] })
  });

  const esCampo = entrega.modalidad === 'ENTREGA_EN_CAMPO';
  const mutacionActiva = marcarEnTransito.isPending || confirmarEntregado.isPending;
  const error = marcarEnTransito.error || confirmarEntregado.error;

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm space-y-3">
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="font-semibold">{producto?.nombre}</p>
          <p className="text-sm text-gray-600">
            {Number(entrega.ordenCompra?.volumenFinal)} {producto?.unidadMedida}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {entrega.productor?.usuario?.nombre} {entrega.productor?.usuario?.apellido}
          </p>
        </div>
        <EstadoEntregaBadge estado={entrega.estado} />
      </div>

      {!esCampo && (
        <p className="text-xs text-gray-500">Retiro en depósito de AUT — lo confirma AUT cuando el productor pasa a buscarlo.</p>
      )}

      {entrega.direccionCampo && (
        <p className="text-sm text-gray-600">📍 {entrega.direccionCampo}</p>
      )}

      {error && (
        <p className="text-red-600 text-sm">
          {error.response?.data?.error?.message || 'No se pudo actualizar la entrega'}
        </p>
      )}

      {esCampo && entrega.estado === 'PENDIENTE' && (
        <button
          onClick={() => marcarEnTransito.mutate()}
          disabled={mutacionActiva}
          className="w-full bg-aut-verde text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {marcarEnTransito.isPending ? 'Guardando...' : 'Marcar como despachado'}
        </button>
      )}

      {esCampo && ['EN_TRANSITO', 'EN_RUTA_A_CAMPO'].includes(entrega.estado) && (
        <button
          onClick={() => confirmarEntregado.mutate()}
          disabled={mutacionActiva}
          className="w-full bg-aut-verde text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {confirmarEntregado.isPending ? 'Guardando...' : '✓ Marcar como entregado'}
        </button>
      )}
    </div>
  );
}
