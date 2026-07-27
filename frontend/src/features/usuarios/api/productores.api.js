import { apiClient } from '../../../api/client';

export const productoresApi = {
  listar: (params) => apiClient.get('/productores', { params }).then((r) => r.data),
  listarPendientes: () => apiClient.get('/productores/pendientes').then((r) => r.data),
  obtener: (id) => apiClient.get(`/productores/${id}`).then((r) => r.data),
  actualizar: (id, datos) => apiClient.patch(`/productores/${id}`, datos).then((r) => r.data),
  aprobar: (id) => apiClient.patch(`/productores/${id}/aprobar`).then((r) => r.data),
  rechazar: (id, motivo) => apiClient.patch(`/productores/${id}/rechazar`, { motivo })
};
