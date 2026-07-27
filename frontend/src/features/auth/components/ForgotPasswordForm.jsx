import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useForgotPassword } from '../hooks/useAuth';

const schema = z.object({
  email: z.string().email('Email inválido')
});

export function ForgotPasswordForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });
  const forgotPassword = useForgotPassword();

  if (forgotPassword.isSuccess) {
    return (
      <div className="w-full max-w-sm space-y-4 p-6 text-center">
        <h1 className="text-2xl font-bold text-aut-verde">Revisá tu email</h1>
        <p className="text-sm text-gray-600">
          Si el email existe, te enviamos un enlace para restablecer tu contraseña.
        </p>
        <Link to="/login" className="text-aut-verde font-medium text-sm">Volver a ingresar</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((data) => forgotPassword.mutate(data.email))}
          className="w-full max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold text-aut-verde">Restablecer contraseña</h1>
      <p className="text-sm text-gray-600">Ingresá tu email y te mandamos un enlace para elegir una nueva contraseña.</p>

      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input {...register('email')} type="email" autoComplete="email"
               className="w-full px-3 py-3 border rounded-lg text-base" />
        {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
      </div>

      <button type="submit" disabled={forgotPassword.isPending}
              className="w-full bg-aut-verde text-white py-3 rounded-lg font-medium disabled:opacity-50">
        {forgotPassword.isPending ? 'Enviando...' : 'Enviar enlace'}
      </button>

      <p className="text-sm text-center text-gray-600">
        <Link to="/login" className="text-aut-verde font-medium">Volver a ingresar</Link>
      </p>
    </form>
  );
}
