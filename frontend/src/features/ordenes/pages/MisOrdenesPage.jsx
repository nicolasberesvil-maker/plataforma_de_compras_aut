import { useQuery } from '@tanstack/react-query';
import { ordenesApi } from '../api/ordenes.api';
import { OrdenCard } from '../components/OrdenCard';

export function MisOrdenesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['ordenes', 'mias'],
    queryFn: () => ordenesApi.listarMias()
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Mis órdenes</h2>
        <p className="text-sm text-gray-500">Tus compras ya confirmadas: precio, proveedor y cantidad definitivos.</p>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !data?.ordenes.length ? (
        <p className="text-gray-500 text-sm">Todavía no tenés compras concretadas.</p>
      ) : (
        <div className="space-y-3">
          {data.ordenes.map((orden) => <OrdenCard key={orden.id} orden={orden} />)}
        </div>
      )}
    </div>
  );
}
