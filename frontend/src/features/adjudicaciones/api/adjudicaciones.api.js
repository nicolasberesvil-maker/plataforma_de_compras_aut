import { apiClient } from '../../../api/client';

export const adjudicacionesApi = {
  obtenerComparador: (campanaId) => apiClient.get(`/adjudicaciones/comparador/${campanaId}`).then((r) => r.data),
  adjudicar: (datos) => apiClient.post('/adjudicaciones', datos).then((r) => r.data),
  obtenerPorCampana: (campanaId) => apiClient.get(`/adjudicaciones/campana/${campanaId}`).then((r) => r.data)
};
