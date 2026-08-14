import { useQuery } from '@tanstack/react-query';
import { cotizacionesApi } from '../api/cotizaciones.api';
import { CampanaCotizableCard } from '../components/CampanaCotizableCard';
import { LoteCotizableCard } from '../components/LoteCotizableCard';

export function CampanasParaCotizarPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['cotizaciones', 'campanas'],
    queryFn: () => cotizacionesApi.listarCampanasParaCotizar()
  });

  const campanas = data?.campanas ?? [];
  const sueltas = campanas.filter((c) => !c.loteId);
  const lotes = Object.values(
    campanas
      .filter((c) => c.loteId)
      .reduce((acc, c) => {
        if (!acc[c.loteId]) acc[c.loteId] = { lote: c.lote, campanas: [] };
        acc[c.loteId].campanas.push(c);
        return acc;
      }, {})
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Licitaciones abiertas</h2>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !campanas.length ? (
        <p className="text-gray-500 text-sm">No hay licitaciones abiertas por ahora.</p>
      ) : (
        <div className="space-y-3">
          {lotes.map(({ lote, campanas: campanasDelLote }) => (
            <LoteCotizableCard key={lote.id} lote={lote} campanas={campanasDelLote} />
          ))}
          {sueltas.map((campana) => <CampanaCotizableCard key={campana.id} campana={campana} />)}
        </div>
      )}
    </div>
  );
}
