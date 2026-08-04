import { useQuery } from '@tanstack/react-query';
import { ordenesApi } from '../api/ordenes.api';
import { OrdenCard } from '../components/OrdenCard';

export function MisVentasPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['ordenes', 'mias-proveedor'],
    queryFn: () => ordenesApi.listarMiasProveedor()
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Historial de ventas</h2>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !data?.ordenes.length ? (
        <p className="text-gray-500 text-sm">Todavía no tenés ventas concretadas.</p>
      ) : (
        <div className="space-y-3">
          {data.ordenes.map((orden) => <OrdenCard key={orden.id} orden={orden} mostrarProductor />)}
        </div>
      )}
    </div>
  );
}
