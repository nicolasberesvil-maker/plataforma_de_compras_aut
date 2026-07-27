import { apiClient } from '../../../api/client';

export const intencionesApi = {
  listarMias: () => apiClient.get('/intenciones/mias').then((r) => r.data),
  listar: (params) => apiClient.get('/intenciones', { params }).then((r) => r.data),
  obtener: (id) => apiClient.get(`/intenciones/${id}`).then((r) => r.data),
  crear: (datos) => apiClient.post('/intenciones', datos).then((r) => r.data),
  actualizar: (id, datos) => apiClient.patch(`/intenciones/${id}`, datos).then((r) => r.data),
  eliminar: (id) => apiClient.delete(`/intenciones/${id}`).then((r) => r.data),
  descartar: (id, motivo) => apiClient.post(`/intenciones/${id}/descartar`, { motivo }).then((r) => r.data),
  agrupar: (datos) => apiClient.post('/intenciones/agrupar', datos).then((r) => r.data)
};
