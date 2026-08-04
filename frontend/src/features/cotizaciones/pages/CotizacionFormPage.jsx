import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cotizacionesApi } from '../api/cotizaciones.api';
import { CotizacionForm } from '../components/CotizacionForm';
import { BackButton } from '../../../components/BackButton';

export function CotizacionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['cotizaciones', 'campanas'],
    queryFn: () => cotizacionesApi.listarCampanasParaCotizar()
  });

  if (isLoading) return <p className="p-4 text-gray-500 text-sm">Cargando...</p>;

  const campana = data?.campanas.find((c) => c.id === Number(id));
  if (!campana) return <p className="p-4 text-gray-500 text-sm">No encontrada.</p>;

  return (
    <div className="max-w-3xl">
      <div className="px-4 pt-4"><BackButton to="/proveedor" /></div>
      <h2 className="text-lg font-bold px-4 pt-4">
        {campana.miCotizacion ? 'Editar cotización' : 'Nueva cotización'}
      </h2>
      <CotizacionForm
        campana={campana}
        cotizacionExistente={campana.miCotizacion}
        onGuardado={() => navigate('/proveedor/mis-cotizaciones')}
      />
    </div>
  );
}
