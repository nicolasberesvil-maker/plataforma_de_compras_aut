import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cotizacionesApi } from '../api/cotizaciones.api';
import { CotizacionLoteForm } from '../components/CotizacionLoteForm';
import { BackButton } from '../../../components/BackButton';

export function CotizacionLoteFormPage() {
  const { loteId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['cotizaciones', 'campanas'],
    queryFn: () => cotizacionesApi.listarCampanasParaCotizar()
  });

  if (isLoading) return <p className="p-4 text-gray-500 text-sm">Cargando...</p>;

  const campanasDelLote = (data?.campanas ?? []).filter((c) => c.loteId === Number(loteId));
  const lote = campanasDelLote[0]?.lote;
  if (!lote) return <p className="p-4 text-gray-500 text-sm">No encontrado.</p>;

  return (
    <div className="max-w-3xl">
      <div className="px-4 pt-4"><BackButton to="/proveedor" /></div>
      <h2 className="text-lg font-bold px-4 pt-4">Cotizar lote</h2>
      <CotizacionLoteForm
        lote={lote}
        campanas={campanasDelLote}
        onGuardado={() => navigate('/proveedor/mis-cotizaciones')}
      />
    </div>
  );
}
