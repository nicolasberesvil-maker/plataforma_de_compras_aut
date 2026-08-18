import { apiClient } from '../../../api/client';

export const campanasApi = {
  listar: (params) => apiClient.get('/campanas', { params }).then((r) => r.data),
  obtener: (id) => apiClient.get(`/campanas/${id}`).then((r) => r.data),
  obtenerResumen: (id) => apiClient.get(`/campanas/${id}/resumen`).then((r) => r.data),
  crear: (datos) => apiClient.post('/campanas', datos).then((r) => r.data),
  actualizar: (id, datos) => apiClient.patch(`/campanas/${id}`, datos).then((r) => r.data),
  abrir: (id) => apiClient.post(`/campanas/${id}/abrir`).then((r) => r.data),
  completarRequisitosLicitacion: (id, datos) => apiClient.post(`/campanas/${id}/requisitos-licitacion`, datos).then((r) => r.data),
  cerrarIntenciones: (id) => apiClient.post(`/campanas/${id}/cerrar-intenciones`, {}).then((r) => r.data),
  adjudicarDirecta: (id, datos) => apiClient.post(`/campanas/${id}/adjudicar-directa`, datos).then((r) => r.data),
  generarTanda: (id, datos) => apiClient.post(`/campanas/${id}/generar-tanda`, datos).then((r) => r.data),
  avisarProductores: (id) => apiClient.post(`/campanas/${id}/avisar-productores`).then((r) => r.data),
  enviarOrdenProveedor: (id) => apiClient.post(`/campanas/${id}/enviar-orden-proveedor`).then((r) => r.data),
  cancelar: (id, motivo) => apiClient.post(`/campanas/${id}/cancelar`, { motivo }).then((r) => r.data)
};
