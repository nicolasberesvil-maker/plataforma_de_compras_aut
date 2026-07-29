import { useQuery } from '@tanstack/react-query';
import { ordenesApi } from '../api/ordenes.api';
import { OrdenCard } from '../components/OrdenCard';

export function MisOrdenesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['ordenes', 'mias'],
    queryFn: () => ordenesApi.listarMias()
  });

  return (
    <div className="max-w-lg mx-auto space-y-4 p-4">
      <h2 className="text-lg font-bold">Mis órdenes</h2>

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
