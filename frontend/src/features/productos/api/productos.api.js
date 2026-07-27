import { apiClient } from '../../../api/client';

export const productosApi = {
  listar: (params) => apiClient.get('/productos', { params }).then((r) => r.data),
  obtener: (id) => apiClient.get(`/productos/${id}`).then((r) => r.data),
  crear: (datos) => apiClient.post('/productos', datos).then((r) => r.data),
  actualizar: (id, datos) => apiClient.patch(`/productos/${id}`, datos).then((r) => r.data),
  desactivar: (id) => apiClient.delete(`/productos/${id}`)
};
