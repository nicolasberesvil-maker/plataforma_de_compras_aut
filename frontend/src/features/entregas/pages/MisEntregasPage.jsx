import { useQuery } from '@tanstack/react-query';
import { entregasApi } from '../api/entregas.api';
import { EntregaCard } from '../components/EntregaCard';

export function MisEntregasPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['entregas', 'mias'],
    queryFn: () => entregasApi.listarMias()
  });

  return (
    <div className="max-w-lg mx-auto space-y-4 p-4">
      <h2 className="text-lg font-bold">Mis entregas</h2>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !data?.entregas.length ? (
        <p className="text-gray-500 text-sm">Todavía no tenés entregas en curso.</p>
      ) : (
        <div className="space-y-3">
          {data.entregas.map((entrega) => <EntregaCard key={entrega.id} entrega={entrega} />)}
        </div>
      )}
    </div>
  );
}
