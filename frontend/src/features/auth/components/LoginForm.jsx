import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useLogin } from '../hooks/useAuth';

const schema = z.object({
  username: z.string().min(1, 'Requerido'),
  password: z.string().min(1, 'Requerido')
});

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });
  const login = useLogin();
  const [mostrarPassword, setMostrarPassword] = useState(false);

  return (
    <form onSubmit={handleSubmit((data) => login.mutate(data))}
          className="w-full max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold text-aut-verde">Ingresar</h1>

      <div>
        <label className="block text-sm font-medium mb-1">Usuario</label>
        <input {...register('username')} type="text" autoComplete="username"
               className="w-full px-3 py-3 border rounded-lg text-base" />
        {errors.username && <p className="text-red-600 text-sm mt-1">{errors.username.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Contraseña</label>
        <div className="relative">
          <input {...register('password')} type={mostrarPassword ? 'text' : 'password'} autoComplete="current-password"
                 className="w-full px-3 py-3 pr-10 border rounded-lg text-base" />
          <button
            type="button"
            onClick={() => setMostrarPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
            aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
      </div>

      {login.isError && (
        <div className="text-red-600 text-sm">
          {login.error.response?.data?.error?.message || 'Error al ingresar'}
        </div>
      )}

      <button type="submit" disabled={login.isPending}
              className="w-full bg-aut-verde text-white py-3 rounded-lg font-medium disabled:opacity-50">
        {login.isPending ? 'Ingresando...' : 'Ingresar'}
      </button>

      <p className="text-sm text-center">
        <Link to="/forgot-password" className="text-gray-600">¿Olvidaste tu contraseña?</Link>
      </p>
    </form>
  );
}
