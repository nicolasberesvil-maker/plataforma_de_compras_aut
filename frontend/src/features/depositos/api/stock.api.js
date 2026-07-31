import { apiClient } from '../../../api/client';

export const stockApi = {
  listarMovimientos: (params) => apiClient.get('/stock-movimientos', { params }).then((r) => r.data),
  registrarIngreso: (datos) => apiClient.post('/stock-movimientos/ingresos', datos).then((r) => r.data),
  registrarAjuste: (datos) => apiClient.post('/stock-movimientos/ajustes', datos).then((r) => r.data),
  registrarTransferencia: (datos) => apiClient.post('/stock-movimientos/transferencias', datos).then((r) => r.data)
};
