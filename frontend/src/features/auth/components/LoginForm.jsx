import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Requerido')
});

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });
  const login = useLogin();

  return (
    <form onSubmit={handleSubmit((data) => login.mutate(data))}
          className="w-full max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold text-aut-verde">Ingresar</h1>

      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input {...register('email')} type="email" autoComplete="email"
               className="w-full px-3 py-3 border rounded-lg text-base" />
        {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Contraseña</label>
        <input {...register('password')} type="password" autoComplete="current-password"
               className="w-full px-3 py-3 border rounded-lg text-base" />
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

      <p className="text-sm text-center text-gray-600">
        ¿No tenés cuenta? <Link to="/registro" className="text-aut-verde font-medium">Registrate</Link>
      </p>
    </form>
  );
}
