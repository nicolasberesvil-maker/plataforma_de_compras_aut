import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { campanasApi } from '../api/campanas.api';

export function CampanasAbiertasPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['campanas', { estado: 'ABIERTA' }],
    queryFn: () => campanasApi.listar({ estado: 'ABIERTA', limit: 50 })
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Pedidos de cotización abiertos</h2>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !data?.data.length ? (
        <p className="text-gray-500 text-sm">No hay pedidos de cotización abiertos por ahora.</p>
      ) : (
        <div className="space-y-3">
          {data.data.map((campana) => (
            <Link
              key={campana.id}
              to={`/productor/campanas/${campana.id}`}
              className="block bg-white border rounded-lg p-4 active:bg-gray-50"
            >
              <p className="font-medium">{campana.nombre}</p>
              <p className="text-sm text-gray-600">{campana.producto?.nombre}</p>
              {campana.fechaCierre && (
                <p className="text-xs text-gray-500 mt-1">
                  Cierra: {new Date(campana.fechaCierre).toLocaleDateString('es-AR')}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
