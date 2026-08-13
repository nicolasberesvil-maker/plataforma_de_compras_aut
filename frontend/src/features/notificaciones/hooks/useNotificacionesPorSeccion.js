import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../../hooks/useSocket';
import { notificacionesApi } from '../api/notificaciones.api';
import { MAPAS_POR_ROL } from '../notificaciones.mapa';

/**
 * Agrupa las notificaciones no leídas por sección del sidebar (según el rol),
 * para mostrar un badge por pestaña además de la campanita.
 */
export function useNotificacionesPorSeccion(rol) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const mapa = MAPAS_POR_ROL[rol] ?? {};

  const { data } = useQuery({
    queryKey: ['notificaciones', 'no-leidas-lista'],
    queryFn: () => notificacionesApi.listar({ soloNoLeidas: true, limit: 100 })
  });

  useEffect(() => {
    if (!socket) return;

    function handleNuevaNotificacion() {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    }

    socket.on('notificacion:nueva', handleNuevaNotificacion);
    return () => socket.off('notificacion:nueva', handleNuevaNotificacion);
  }, [socket, queryClient]);

  const notificaciones = data?.data ?? [];
  const conteos = {};
  for (const n of notificaciones) {
    const ruta = mapa[n.tipo];
    if (!ruta) continue;
    conteos[ruta] = (conteos[ruta] ?? 0) + 1;
  }

  const marcarSeccionComoLeida = useMutation({
    mutationFn: async (ruta) => {
      const idsDeLaSeccion = notificaciones.filter((n) => mapa[n.tipo] === ruta).map((n) => n.id);
      await Promise.all(idsDeLaSeccion.map((id) => notificacionesApi.marcarComoLeida(id)));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] })
  });

  return { conteos, marcarSeccionComoLeida: marcarSeccionComoLeida.mutate };
}
