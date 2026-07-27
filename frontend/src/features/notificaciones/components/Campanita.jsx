import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../../hooks/useSocket';
import { notificacionesApi } from '../api/notificaciones.api';

export function Campanita() {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);

  const { data: count = 0 } = useQuery({
    queryKey: ['notificaciones', 'count'],
    queryFn: () => notificacionesApi.contarNoLeidas(),
    refetchInterval: 60_000
  });

  const { data } = useQuery({
    queryKey: ['notificaciones', 'lista'],
    queryFn: () => notificacionesApi.listar({ limit: 10 }),
    enabled: abierto
  });

  useEffect(() => {
    if (!socket) return;

    function handleNuevaNotificacion() {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    }

    socket.on('notificacion:nueva', handleNuevaNotificacion);
    return () => socket.off('notificacion:nueva', handleNuevaNotificacion);
  }, [socket, queryClient]);

  return (
    <div className="relative">
      <button onClick={() => setAbierto((v) => !v)} className="relative p-2 text-gray-600">
        <span aria-hidden>🔔</span>
        {count > 0 && (
          <span className="absolute top-0 right-0 bg-aut-naranja text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
          {!data?.data.length ? (
            <p className="p-4 text-sm text-gray-500">No tenés notificaciones.</p>
          ) : (
            data.data.map((n) => (
              <div key={n.id} className={`p-3 border-b text-sm ${n.leida ? 'bg-white' : 'bg-green-50'}`}>
                <p className="font-medium">{n.titulo}</p>
                <p className="text-gray-600">{n.mensaje}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
