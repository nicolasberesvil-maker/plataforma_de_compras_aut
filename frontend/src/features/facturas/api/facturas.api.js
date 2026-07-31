import { apiClient } from '../../../api/client';

export const facturasApi = {
  listarMias: () => apiClient.get('/facturas/mias').then((r) => r.data),
  listar: (filtros = {}) => apiClient.get('/facturas', { params: filtros }).then((r) => r.data),
  obtener: (id) => apiClient.get(`/facturas/${id}`).then((r) => r.data),
  generar: (ordenCompraId) => apiClient.post(`/facturas/generar/${ordenCompraId}`).then((r) => r.data),
  descargarPdf: (id) => apiClient.get(`/facturas/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data)
};
