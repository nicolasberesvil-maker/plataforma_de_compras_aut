import { apiClient } from '../../../api/client';

export const resumenApi = {
  listarPedidos: (params) => apiClient.get('/resumen/pedidos', { params }).then((r) => r.data)
};
