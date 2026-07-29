import { apiClient } from '../../../api/client';

export const cotizacionesApi = {
  listarMias: () => apiClient.get('/cotizaciones/mias').then((r) => r.data),
  listarCampanasParaCotizar: () => apiClient.get('/cotizaciones/campanas').then((r) => r.data),
  obtener: (id) => apiClient.get(`/cotizaciones/${id}`).then((r) => r.data),
  crear: (datos) => apiClient.post('/cotizaciones', datos).then((r) => r.data),
  actualizar: (id, datos) => apiClient.patch(`/cotizaciones/${id}`, datos).then((r) => r.data),
  eliminar: (id) => apiClient.delete(`/cotizaciones/${id}`).then((r) => r.data)
};
