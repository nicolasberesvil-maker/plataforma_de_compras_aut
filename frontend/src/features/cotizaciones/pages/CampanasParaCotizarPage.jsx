import { useQuery } from '@tanstack/react-query';
import { cotizacionesApi } from '../api/cotizaciones.api';
import { CampanaCotizableCard } from '../components/CampanaCotizableCard';

export function CampanasParaCotizarPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['cotizaciones', 'campanas'],
    queryFn: () => cotizacionesApi.listarCampanasParaCotizar()
  });

  return (
    <div className="max-w-lg mx-auto space-y-4 p-4">
      <h2 className="text-lg font-bold">Licitaciones abiertas</h2>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !data?.campanas.length ? (
        <p className="text-gray-500 text-sm">No hay licitaciones abiertas por ahora.</p>
      ) : (
        <div className="space-y-3">
          {data.campanas.map((campana) => <CampanaCotizableCard key={campana.id} campana={campana} />)}
        </div>
      )}
    </div>
  );
}
