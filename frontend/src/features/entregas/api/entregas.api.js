import { apiClient } from '../../../api/client';

export const entregasApi = {
  listarMias: () => apiClient.get('/entregas/mias').then((r) => r.data),
  listar: (filtros = {}) => apiClient.get('/entregas', { params: filtros }).then((r) => r.data),
  obtener: (id) => apiClient.get(`/entregas/${id}`).then((r) => r.data),
  marcarEnTransito: (id, datos = {}) => apiClient.patch(`/entregas/${id}/en-transito`, datos).then((r) => r.data),
  marcarDisponible: (id, datos = {}) => apiClient.patch(`/entregas/${id}/disponible`, datos).then((r) => r.data),
  confirmarRetiro: (id, datos) => apiClient.patch(`/entregas/${id}/confirmar-retiro`, datos).then((r) => r.data),
  confirmarEntregaCampo: (id, datos = {}) => apiClient.patch(`/entregas/${id}/confirmar-entrega-campo`, datos).then((r) => r.data),
  cancelar: (id, motivo) => apiClient.patch(`/entregas/${id}/cancelar`, { motivo }).then((r) => r.data)
};
