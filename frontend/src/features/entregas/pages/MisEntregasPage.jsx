import { useQuery } from '@tanstack/react-query';
import { entregasApi } from '../api/entregas.api';
import { EntregaCard } from '../components/EntregaCard';

export function MisEntregasPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['entregas', 'mias'],
    queryFn: () => entregasApi.listarMias()
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Mis entregas</h2>
        <p className="text-sm text-gray-500">Cuándo y dónde vas a recibir cada orden: retiro en depósito de AUT o entrega en tu campo.</p>
      </div>

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
