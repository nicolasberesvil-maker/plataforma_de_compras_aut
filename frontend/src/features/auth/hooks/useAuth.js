import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../../../store/authStore';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ email, password }) => authApi.login(email, password),
    onSuccess: (data) => {
      setAuth(data.accessToken, data.usuario);
      const ruta = data.usuario.rol === 'PRODUCTOR' ? '/productor'
        : data.usuario.rol === 'PROVEEDOR' ? '/proveedor'
        : data.usuario.rol === 'OPERADOR_DEPOSITO' ? '/deposito' : '/admin';
      navigate(ruta);
    }
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      logout();
      navigate('/login');
    }
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (datos) => authApi.register(datos)
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email) => authApi.forgotPassword(email)
  });
}

export function useResetPassword() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ token, nuevaPassword }) => authApi.resetPassword(token, nuevaPassword),
    onSuccess: () => navigate('/login')
  });
}
