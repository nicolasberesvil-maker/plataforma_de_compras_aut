import { apiClient } from '../../../api/client';

export const dashboardApi = {
  kpis: (filtros = {}) => apiClient.get('/dashboard/kpis', { params: filtros }).then((r) => r.data),
  volumenPorInsumo: (filtros = {}) => apiClient.get('/dashboard/volumen-por-insumo', { params: filtros }).then((r) => r.data),
  rankingProveedores: (filtros = {}) => apiClient.get('/dashboard/ranking-proveedores', { params: filtros }).then((r) => r.data),
  topProductores: () => apiClient.get('/dashboard/top-productores').then((r) => r.data),
  balanceIva: (filtros = {}) => apiClient.get('/dashboard/balance-iva', { params: filtros }).then((r) => r.data),
  formasPago: () => apiClient.get('/dashboard/formas-pago').then((r) => r.data),
  exportarExcel: (filtros = {}) => apiClient.get('/dashboard/export', { params: filtros, responseType: 'blob' }).then((r) => r.data),
  mi: () => apiClient.get('/dashboard/mi').then((r) => r.data)
};
