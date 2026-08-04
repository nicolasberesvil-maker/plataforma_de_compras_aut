import { useQuery } from '@tanstack/react-query';
import { facturasApi } from '../api/facturas.api';
import { FacturaCard } from '../components/FacturaCard';

export function MisFacturasPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['facturas', 'mias'],
    queryFn: () => facturasApi.listarMias()
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Mis facturas</h2>
        <p className="text-sm text-gray-500">Los comprobantes de cada orden ya entregada.</p>
      </div>

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
