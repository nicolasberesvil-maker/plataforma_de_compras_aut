import { apiClient } from '../../../api/client';

export const notificacionesApi = {
  listar: (params) => apiClient.get('/notificaciones', { params }).then((r) => r.data),
  contarNoLeidas: () => apiClient.get('/notificaciones/no-leidas/count').then((r) => r.data.count),
  marcarComoLeida: (id) => apiClient.patch(`/notificaciones/${id}/leida`).then((r) => r.data)
};
