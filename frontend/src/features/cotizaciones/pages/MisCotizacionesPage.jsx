import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { cotizacionesApi } from '../api/cotizaciones.api';

export function MisCotizacionesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['cotizaciones', 'mias'],
    queryFn: () => cotizacionesApi.listarMias()
  });

  return (
    <div className="max-w-lg mx-auto space-y-4 p-4">
      <h2 className="text-lg font-bold">Mis cotizaciones</h2>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !data?.cotizaciones.length ? (
        <p className="text-gray-500 text-sm">Todavía no enviaste ninguna cotización.</p>
      ) : (
        <div className="space-y-3">
          {data.cotizaciones.map((cotizacion) => (
            <Link
              key={cotizacion.id}
              to={`/proveedor/campanas/${cotizacion.campanaId}/cotizar`}
              className="block bg-white border rounded-lg p-4 active:bg-gray-50"
            >
              <p className="font-medium">{cotizacion.campana.producto.nombre}</p>
              <p className="text-sm text-gray-600">{cotizacion.campana.nombre}</p>
              <p className="text-sm mt-1">
                {cotizacion.monedaPrecio} {Number(cotizacion.precioUnitario)} · {cotizacion.plazoEntregaDias} días
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Válida hasta: {new Date(cotizacion.validaHasta).toLocaleDateString('es-AR')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
