import { apiClient } from '../../../api/client';

export const productoresApi = {
  listar: (params) => apiClient.get('/productores', { params }).then((r) => r.data),
  obtener: (id) => apiClient.get(`/productores/${id}`).then((r) => r.data),
  crear: (datos) => apiClient.post('/productores', datos).then((r) => r.data),
  actualizar: (id, datos) => apiClient.patch(`/productores/${id}`, datos).then((r) => r.data),
  miCuenta: () => apiClient.get('/productores/mi-cuenta').then((r) => r.data),
  cuentaCorriente: (id) => apiClient.get(`/productores/${id}/cuenta-corriente`).then((r) => r.data)
};
