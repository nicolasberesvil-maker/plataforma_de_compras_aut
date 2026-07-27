import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

// Singleton a nivel de módulo (mismo patrón que api/client.js): no vive en
// estado/ref de React porque el compilador de React trata esos contenedores
// como inmutables. socket.io-client encola los emit/on mientras no está
// conectado, así que los componentes no necesitan esperar a que la conexión
// esté lista para suscribirse a eventos.
const socket = io(import.meta.env.VITE_BACKEND_URL, { autoConnect: false });

export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) {
      socket.disconnect();
      return;
    }

    socket.auth = { token: accessToken };
    socket.connect();

    return () => socket.disconnect();
  }, [accessToken]);

  return socket;
}
