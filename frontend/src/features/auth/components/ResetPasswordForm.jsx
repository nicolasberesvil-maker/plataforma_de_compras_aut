import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useSearchParams } from 'react-router-dom';
import { useResetPassword } from '../hooks/useAuth';

const schema = z.object({
  nuevaPassword: z.string().min(8, 'Mínimo 8 caracteres')
});

export function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });
  const resetPassword = useResetPassword();

  if (!token) {
    return (
      <div className="w-full max-w-sm space-y-4 p-6 text-center">
        <h1 className="text-2xl font-bold text-aut-verde">Enlace inválido</h1>
        <p className="text-sm text-gray-600">Pedí un nuevo enlace para restablecer tu contraseña.</p>
        <Link to="/forgot-password" className="text-aut-verde font-medium text-sm">Solicitar enlace</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((data) => resetPassword.mutate({ token, nuevaPassword: data.nuevaPassword }))}
          className="w-full max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold text-aut-verde">Elegí tu nueva contraseña</h1>

      <div>
        <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
        <input {...register('nuevaPassword')} type="password" autoComplete="new-password"
               className="w-full px-3 py-3 border rounded-lg text-base" />
        {errors.nuevaPassword && <p className="text-red-600 text-sm mt-1">{errors.nuevaPassword.message}</p>}
      </div>

      {resetPassword.isError && (
        <div className="text-red-600 text-sm">
          {resetPassword.error.response?.data?.error?.message || 'El enlace es inválido o expiró'}
        </div>
      )}

      <button type="submit" disabled={resetPassword.isPending}
              className="w-full bg-aut-verde text-white py-3 rounded-lg font-medium disabled:opacity-50">
        {resetPassword.isPending ? 'Guardando...' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
