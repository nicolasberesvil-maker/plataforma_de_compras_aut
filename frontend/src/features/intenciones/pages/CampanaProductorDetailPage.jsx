import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../../hooks/useSocket';
import { campanasApi } from '../../campanas/api/campanas.api';
import { ProgresoVolumen } from '../../campanas/components/ProgresoVolumen';
import { PedidoForm } from '../components/PedidoForm';
import { BackButton } from '../../../components/BackButton';

export function CampanaProductorDetailPage() {
  const { id } = useParams();
  const socket = useSocket();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['campanas', id],
    queryFn: () => campanasApi.obtener(id)
  });

  const { data: resumenData } = useQuery({
    queryKey: ['campanas', id, 'resumen'],
    queryFn: () => campanasApi.obtenerResumen(id)
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

  if (isLoading) return <p className="p-4 text-gray-500 text-sm">Cargando...</p>;
  if (!data?.campana) return <p className="p-4 text-gray-500 text-sm">No encontrada.</p>;

  const campana = data.campana;
  const resumen = resumenData?.resumen;
  const miIntencion = resumen?.miIntencionPropia;
  const tieneVolumenMinimo = campana.volumenMinimo && Number(campana.volumenMinimo) > 0;

  return (
    <div className="space-y-4 max-w-3xl">
      <BackButton to="/productor" />
      <div>
        <h2 className="text-lg font-bold">{campana.nombre}</h2>
        <p className="text-sm text-gray-600">{campana.producto?.nombre}</p>
        {campana.lote && (
          <span className="inline-block mt-1 text-xs font-medium bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
            Parte del lote: {campana.lote.nombre}
          </span>
        )}
      </div>

      {tieneVolumenMinimo && resumen ? (
        <div className="bg-white border rounded-lg p-4">
          <ProgresoVolumen
            acumulado={resumen.volumenAcumulado}
            minimo={resumen.volumenMinimo}
            unidad={campana.producto?.unidadMedida}
          />
          <p className="text-xs text-gray-500 mt-2">{resumen.cantidadProductores} productores se sumaron</p>
        </div>
      ) : resumen && (
        <div className="bg-white border rounded-lg p-4 text-sm">
          <p>
            <span className="text-gray-500">Pedido por el grupo: </span>
            {resumen.volumenAcumulado.toLocaleString('es-AR')} {campana.producto?.unidadMedida}
          </p>
          <p className="text-xs text-gray-500 mt-1">{resumen.cantidadProductores} productores se sumaron a este pedido de cotización</p>
        </div>
      )}

      <div className="bg-white border rounded-lg p-4 space-y-1 text-sm">
        {campana.fechaCierre && (
          <p><span className="text-gray-500">Cierra: </span>{new Date(campana.fechaCierre).toLocaleString('es-AR')}</p>
        )}
        {resumen?.fechaEstimadaRecepcion && (
          <p><span className="text-gray-500">Recepción estimada: </span>{new Date(resumen.fechaEstimadaRecepcion).toLocaleDateString('es-AR')}</p>
        )}
        {resumen?.condicionesPagoGanadora && (
          <p><span className="text-gray-500">Forma de pago: </span>{resumen.condicionesPagoGanadora}</p>
        )}
        {resumen?.plazoEntregaDiasGanador != null && (
          <p><span className="text-gray-500">Plazo de entrega: </span>{resumen.plazoEntregaDiasGanador} días</p>
        )}
      </div>

      <div className="bg-white border rounded-lg">
        <h3 className="text-sm font-medium p-4 pb-0">
          {miIntencion ? 'Tu pedido en este pedido de cotización' : 'Sumarme a este pedido de cotización'}
        </h3>
        <PedidoForm campana={campana} pedidoExistente={miIntencion} />
      </div>
    </div>
  );
}
