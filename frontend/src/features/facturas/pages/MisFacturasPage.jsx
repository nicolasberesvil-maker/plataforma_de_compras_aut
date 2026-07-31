import { useQuery } from '@tanstack/react-query';
import { facturasApi } from '../api/facturas.api';
import { FacturaCard } from '../components/FacturaCard';

export function MisFacturasPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['facturas', 'mias'],
    queryFn: () => facturasApi.listarMias()
  });

  return (
    <div className="max-w-lg mx-auto space-y-4 p-4">
      <h2 className="text-lg font-bold">Mis facturas</h2>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !data?.facturas.length ? (
        <p className="text-gray-500 text-sm">Todavía no tenés facturas emitidas.</p>
      ) : (
        <div className="space-y-3">
          {data.facturas.map((factura) => (
            <FacturaCard key={factura.id} factura={factura} detailTo={`/productor/facturas/${factura.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
