import { useMutation, useQueryClient } from '@tanstack/react-query';
import { facturasApi } from '../api/facturas.api';

export function BotonGenerarFactura({ ordenCompraId, onGenerada }) {
  const queryClient = useQueryClient();

  const generar = useMutation({
    mutationFn: () => facturasApi.generar(ordenCompraId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      onGenerada?.(data.factura);
    }
  });

  return (
    <div>
      <button
        onClick={() => generar.mutate()}
        disabled={generar.isPending}
        className="bg-aut-verde text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {generar.isPending ? 'Generando...' : 'Generar factura'}
      </button>
      {generar.isError && (
        <p className="text-xs text-red-600 mt-1">
          {generar.error?.response?.data?.error?.message ?? 'No se pudo generar la factura'}
        </p>
      )}
    </div>
  );
}
