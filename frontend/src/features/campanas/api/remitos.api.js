import { apiClient } from '../../../api/client';

export const remitosApi = {
  listar: (campanaId) => apiClient.get(`/campanas/${campanaId}/remitos`).then((r) => r.data),
  crear: (campanaId, datos) => apiClient.post(`/campanas/${campanaId}/remitos`, datos).then((r) => r.data)
};
