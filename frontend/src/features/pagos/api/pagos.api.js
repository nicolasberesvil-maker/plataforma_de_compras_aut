import { apiClient } from '../../../api/client';

export const pagosApi = {
  listarMios: () => apiClient.get('/pagos/mios').then((r) => r.data),
  listar: (params) => apiClient.get('/pagos', { params }).then((r) => r.data),
  crear: (datos) => apiClient.post('/pagos', datos).then((r) => r.data),
  confirmar: (id) => apiClient.patch(`/pagos/${id}/confirmar`).then((r) => r.data),
  rechazar: (id, motivo) => apiClient.patch(`/pagos/${id}/rechazar`, { motivo }).then((r) => r.data)
};
