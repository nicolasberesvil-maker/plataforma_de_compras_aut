import { apiClient } from '../../../api/client';

export const proveedoresApi = {
  listar: (params) => apiClient.get('/proveedores', { params }).then((r) => r.data),
  obtener: (id) => apiClient.get(`/proveedores/${id}`).then((r) => r.data),
  crear: (datos) => apiClient.post('/proveedores', datos).then((r) => r.data),
  actualizar: (id, datos) => apiClient.patch(`/proveedores/${id}`, datos).then((r) => r.data),
  aprobar: (id) => apiClient.patch(`/proveedores/${id}/aprobar`).then((r) => r.data),
  suspender: (id) => apiClient.patch(`/proveedores/${id}/suspender`).then((r) => r.data),
  cuentaCorriente: (id) => apiClient.get(`/proveedores/${id}/cuenta-corriente`).then((r) => r.data),
  registrarPago: (id, datos) => apiClient.post(`/proveedores/${id}/pagos`, datos).then((r) => r.data)
};
