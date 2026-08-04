import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../../hooks/useSocket';
import { campanasApi } from '../api/campanas.api';
import { TipoBadge } from '../components/TipoBadge';
import { EstadoBadge } from '../components/EstadoBadge';
import { CotizacionEstadoBadge } from '../components/CotizacionEstadoBadge';
import { ProgresoVolumen } from '../components/ProgresoVolumen';
import { AccionesCampana } from '../components/AccionesCampana';
import { OrdenesTab } from '../components/OrdenesTab';
import { RemitosTab } from '../components/RemitosTab';

const TABS = [
  { id: 'ordenes', label: 'Órdenes de compra' },
  { id: 'remitos', label: 'Remitos' }
];

export function CampanaDetailPage() {
  const { id } = useParams();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('ordenes');

  const { data, isLoading } = useQuery({
    queryKey: ['campanas', id],
    queryFn: () => campanasApi.obtener(id)
  });

  const { data: resumenData } = useQuery({
    queryKey: ['campanas', id, 'resumen'],
    queryFn: () => campanasApi.obtenerResumen(id)
  });

  const avisarProductores = useMutation({
    mutationFn: () => campanasApi.avisarProductores(id)
  });

  useEffect(() => {
    if (!socket) return;

    socket.emit('subscribe:campana', { campanaId: Number(id) });

    function handleActualizacion(payload) {
      queryClient.setQueryData(['campanas', id, 'resumen'], (old) => ({
        ...old,
        resumen: old?.resumen && {
          ...old.resumen,
          volumenAcumulado: payload.volumenAcumulado,
          cantidadProductores: payload.cantidadProductores
        }
      }));
    }

    socket.on('campana:actualizada', handleActualizacion);

    return () => {
      socket.emit('unsubscribe:campana', { campanaId: Number(id) });
      socket.off('campana:actualizada', handleActualizacion);
    };
  }, [socket, id, queryClient]);

  if (isLoading) return <p className="text-gray-500 text-sm">Cargando...</p>;
  if (!data?.campana) return <p className="text-gray-500 text-sm">No encontrada.</p>;

  const campana = data.campana;
  const resumen = resumenData?.resumen;
  const tieneVolumenMinimo = campana.volumenMinimo && Number(campana.volumenMinimo) > 0;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{campana.nombre}</h2>
            <TipoBadge tipo={campana.tipo} />
            <EstadoBadge estado={campana.estado} />
            <CotizacionEstadoBadge campana={campana} />
          </div>
          <p className="text-sm text-gray-600">{campana.producto?.nombre}</p>
        </div>
        <div className="flex items-center gap-3">
          {campana.estado === 'ABIERTA' && (
            <button
              onClick={() => avisarProductores.mutate()}
              disabled={avisarProductores.isPending}
              className="text-sm text-aut-verde font-medium disabled:opacity-50"
            >
              {avisarProductores.isPending ? 'Avisando...' : avisarProductores.isSuccess ? 'Aviso enviado ✓' : 'Avisar a productores'}
            </button>
          )}
          {campana.estado === 'BORRADOR' && (
            <Link to={`/admin/campanas/${campana.id}/editar`} className="text-aut-verde text-sm font-medium">
              Editar
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-3">
        {campana.descripcion && <p className="text-sm text-gray-700">{campana.descripcion}</p>}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Apertura: </span>
            {new Date(campana.fechaApertura).toLocaleString('es-AR')}
          </div>
          <div>
            <span className="text-gray-500">Cierre: </span>
            {campana.fechaCierre ? new Date(campana.fechaCierre).toLocaleString('es-AR') : '— (no cierra por fecha)'}
          </div>
          {campana.fechaEstimadaRecepcion && (
            <div>
              <span className="text-gray-500">Recepción estimada: </span>
              {new Date(campana.fechaEstimadaRecepcion).toLocaleDateString('es-AR')}
            </div>
          )}
          {campana.campanaPadreId && (
            <div>
              <span className="text-gray-500">Tanda de: </span>
              <Link to={`/admin/campanas/${campana.campanaPadreId}`} className="text-aut-verde font-medium">
                Campaña #{campana.campanaPadreId}
              </Link>
            </div>
          )}
        </div>

        {tieneVolumenMinimo && resumen && (
          <ProgresoVolumen
            acumulado={resumen.volumenAcumulado}
            minimo={resumen.volumenMinimo}
            unidad={campana.producto?.unidadMedida}
          />
        )}
        {resumen && (
          <p className="text-xs text-gray-500">{resumen.cantidadProductores} productores se sumaron</p>
        )}
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-2">Acciones</h3>
        <AccionesCampana campana={campana} />
      </div>

      <div className="flex gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id ? 'border-aut-verde text-aut-verde' : 'border-transparent text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ordenes' && <OrdenesTab campanaId={campana.id} />}
      {tab === 'remitos' && <RemitosTab campana={campana} />}
    </div>
  );
}
