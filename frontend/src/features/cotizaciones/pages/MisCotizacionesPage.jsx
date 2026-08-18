import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { cotizacionesApi } from '../api/cotizaciones.api';
import { EstadoCotizacionBadge, derivarEstadoCotizacion } from '../components/EstadoCotizacionBadge';
import { Tabs } from '../../../components/Tabs';

const FILTROS = [
  { id: 'TODAS', label: 'Todas' },
  { id: 'COTIZADA', label: 'Cotizadas' },
  { id: 'APROBADA', label: 'Aprobadas' },
  { id: 'RECHAZADA', label: 'Rechazadas' }
];

export function MisCotizacionesPage() {
  const [filtro, setFiltro] = useState('TODAS');

  const { data, isLoading } = useQuery({
    queryKey: ['cotizaciones', 'mias'],
    queryFn: () => cotizacionesApi.listarMias()
  });

  const cotizaciones = data?.cotizaciones ?? [];
  const filtradas = filtro === 'TODAS' ? cotizaciones : cotizaciones.filter((c) => derivarEstadoCotizacion(c) === filtro);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Mis cotizaciones</h2>
        <p className="text-sm text-gray-500">Cotizada: todavía en evaluación. Aprobada: te la adjudicaron. Rechazada: eligieron otra oferta.</p>
      </div>

      <Tabs tabs={FILTROS} value={filtro} onChange={setFiltro} />

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !cotizaciones.length ? (
        <p className="text-gray-500 text-sm">Todavía no enviaste ninguna cotización.</p>
      ) : !filtradas.length ? (
        <p className="text-gray-500 text-sm">No hay cotizaciones en este estado.</p>
      ) : (
        <div className="space-y-3">
          {filtradas.map((cotizacion) => (
            <Link
              key={cotizacion.id}
              to={cotizacion.esGanadora ? `/proveedor/cotizaciones/${cotizacion.id}` : `/proveedor/campanas/${cotizacion.campanaId}/cotizar`}
              className="block bg-white border rounded-lg p-4 active:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <p className="font-medium">{cotizacion.campana.producto.nombre}</p>
                <EstadoCotizacionBadge cotizacion={cotizacion} />
              </div>
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
