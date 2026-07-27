import { apiClient } from '../../../api/client';

export const usuariosApi = {
  listar: (params) => apiClient.get('/usuarios', { params }).then((r) => r.data),
  obtener: (id) => apiClient.get(`/usuarios/${id}`).then((r) => r.data),
  actualizar: (id, datos) => apiClient.patch(`/usuarios/${id}`, datos).then((r) => r.data),
  activar: (id) => apiClient.patch(`/usuarios/${id}/activar`).then((r) => r.data),
  desactivar: (id) => apiClient.patch(`/usuarios/${id}/desactivar`).then((r) => r.data),
  cambiarPassword: (id, datos) => apiClient.post(`/usuarios/${id}/cambiar-password`, datos)
};
