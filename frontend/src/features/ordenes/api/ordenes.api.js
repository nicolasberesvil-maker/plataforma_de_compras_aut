import { apiClient } from '../../../api/client';

export const ordenesApi = {
  listarMias: () => apiClient.get('/ordenes/mias').then((r) => r.data),
  listarMiasProveedor: () => apiClient.get('/ordenes/mias-proveedor').then((r) => r.data),
  listar: (filtros = {}) => apiClient.get('/ordenes', { params: filtros }).then((r) => r.data),
  obtener: (id) => apiClient.get(`/ordenes/${id}`).then((r) => r.data),
  marcarPagada: (id) => apiClient.post(`/ordenes/${id}/marcar-pagada`).then((r) => r.data)
};
