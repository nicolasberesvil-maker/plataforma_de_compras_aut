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
import { RequisitosLicitacionForm } from '../components/RequisitosLicitacionForm';
import { OrdenesTab } from '../components/OrdenesTab';
import { RemitosTab } from '../components/RemitosTab';
import { BackButton } from '../../../components/BackButton';
import { Tabs } from '../../../components/Tabs';

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
    mutationFn: () => campanasApi.avisarProductores(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campanas', id] })
  });

  // Un solo click para el caso más común: publicar el pedido (BORRADOR →
  // ABIERTA) y avisarle a los productores en el mismo paso, en vez de dos
  // acciones separadas que un admin nuevo no sabe que tiene que encadenar.
  const publicarYAvisar = useMutation({
    mutationFn: async () => {
      await campanasApi.abrir(id);
      await campanasApi.avisarProductores(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanas', id] });
      queryClient.invalidateQueries({ queryKey: ['campanas'] });
    }
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
  const faltanRequisitos = campana.estado === 'ABIERTA' && (
    !campana.fechaEstimadaRecepcion || !campana.volumenMaximo ||
    !campana.modalidadesEntregaOfrecidas || !campana.formasPagoOfrecidas
  );

  return (
    <div className="max-w-2xl space-y-4">
      <BackButton to="/admin/pedidos" />
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold">{campana.nombre}</h2>
            <TipoBadge tipo={campana.tipo} />
            <EstadoBadge estado={campana.estado} />
            <CotizacionEstadoBadge campana={campana} />
          </div>
          <p className="text-sm text-gray-600">{campana.producto?.nombre}</p>
          {campana.lote && (
            <Link to={`/admin/resumen?loteId=${campana.lote.id}`} className="text-xs text-purple-700 font-medium">
              Parte del lote: {campana.lote.nombre}
            </Link>
          )}
        </div>
        {campana.estado === 'BORRADOR' && (
          <Link to={`/admin/campanas/${campana.id}/editar`} className="text-aut-verde text-sm font-medium">
            Editar
          </Link>
        )}
      </div>

      {campana.estado === 'BORRADOR' && (
        <button
          onClick={() => publicarYAvisar.mutate()}
          disabled={publicarYAvisar.isPending}
          className="w-full bg-aut-verde text-white py-3 rounded-lg text-base font-semibold shadow-sm disabled:opacity-50"
        >
          {publicarYAvisar.isPending ? 'Publicando...' : '📣 Publicar pedido y avisar a productores'}
        </button>
      )}

      {faltanRequisitos && <RequisitosLicitacionForm campana={campana} />}

      {campana.estado === 'ABIERTA' && (
        <button
          onClick={() => avisarProductores.mutate()}
          disabled={avisarProductores.isPending}
          className="w-full border border-aut-verde text-aut-verde py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {avisarProductores.isPending ? 'Avisando...' : avisarProductores.isSuccess ? 'Aviso reenviado ✓' : 'Volver a avisar a productores'}
        </button>
      )}

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

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'ordenes' && <OrdenesTab campanaId={campana.id} />}
      {tab === 'remitos' && <RemitosTab campana={campana} />}
    </div>
  );
}
