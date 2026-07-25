import { apiClient } from '../../../api/client';

export const authApi = {
  register: (datos) => apiClient.post('/auth/register', datos).then((r) => r.data),
  login: (email, password) => apiClient.post('/auth/login', { email, password }).then((r) => r.data),
  logout: () => apiClient.post('/auth/logout'),
  refresh: () => apiClient.post('/auth/refresh').then((r) => r.data),
  me: () => apiClient.get('/auth/me').then((r) => r.data)
};
