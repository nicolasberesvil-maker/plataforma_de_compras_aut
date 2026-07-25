import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}/api`,
  withCredentials: true
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

// Un 401 en estos endpoints ya ES la respuesta final (credenciales inválidas,
// usuario inactivo, refresh token vencido) — reintentar con auto-refresh no
// tiene sentido y solo tapa el mensaje real con el error del refresh fallido.
const ENDPOINTS_SIN_AUTO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh'];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const esEndpointExcluido = ENDPOINTS_SIN_AUTO_REFRESH.some((path) => original?.url?.includes(path));
    if (error.response?.status === 401 && !original._retry && !esEndpointExcluido) {
      original._retry = true;
      try {
        refreshPromise ??= apiClient.post('/auth/refresh').then((r) => r.data);
        const { accessToken } = await refreshPromise;
        refreshPromise = null;

        useAuthStore.getState().setAuth(accessToken, useAuthStore.getState().usuario);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(original);
      } catch (refreshErr) {
        refreshPromise = null;
        useAuthStore.getState().logout();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);
