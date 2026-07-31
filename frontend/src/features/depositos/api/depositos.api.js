import { apiClient } from '../../../api/client';

export const depositosApi = {
  listar: (params) => apiClient.get('/depositos', { params }).then((r) => r.data),
  obtener: (id) => apiClient.get(`/depositos/${id}`).then((r) => r.data),
  crear: (datos) => apiClient.post('/depositos', datos).then((r) => r.data),
  actualizar: (id, datos) => apiClient.patch(`/depositos/${id}`, datos).then((r) => r.data),
  desactivar: (id) => apiClient.delete(`/depositos/${id}`),
  obtenerStock: (id) => apiClient.get(`/depositos/${id}/stock`).then((r) => r.data)
};
