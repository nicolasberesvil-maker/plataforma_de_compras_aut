import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useRegister } from '../hooks/useAuth';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  nombre: z.string().min(2, 'Requerido'),
  apellido: z.string().min(2, 'Requerido'),
  telefono: z.string().optional(),
  razonSocial: z.string().min(2, 'Requerido'),
  cuit: z.string().regex(/^\d{11}$/, 'CUIT debe tener 11 dígitos'),
  condicionFiscal: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'EXENTO', 'CONSUMIDOR_FINAL']),
  domicilioFiscal: z.string().min(5, 'Requerido'),
  localidad: z.string().min(2, 'Requerido')
});

const CAMPOS = [
  { name: 'nombre', label: 'Nombre', type: 'text' },
  { name: 'apellido', label: 'Apellido', type: 'text' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'password', label: 'Contraseña', type: 'password' },
  { name: 'telefono', label: 'Teléfono (opcional)', type: 'tel' },
  { name: 'razonSocial', label: 'Razón social', type: 'text' },
  { name: 'cuit', label: 'CUIT (11 dígitos)', type: 'text' },
  { name: 'domicilioFiscal', label: 'Domicilio fiscal', type: 'text' },
  { name: 'localidad', label: 'Localidad', type: 'text' }
];

export function RegisterForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });
  const registrar = useRegister();

  return (
    <form onSubmit={handleSubmit((data) => registrar.mutate(data))}
          className="w-full max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold text-aut-verde">Registrarse como productor</h1>

      {CAMPOS.map(({ name, label, type }) => (
        <div key={name}>
          <label className="block text-sm font-medium mb-1">{label}</label>
          <input {...register(name)} type={type}
                 className="w-full px-3 py-3 border rounded-lg text-base" />
          {errors[name] && <p className="text-red-600 text-sm mt-1">{errors[name].message}</p>}
        </div>
      ))}

      <div>
        <label className="block text-sm font-medium mb-1">Condición fiscal</label>
        <select {...register('condicionFiscal')} className="w-full px-3 py-3 border rounded-lg text-base">
          <option value="">Seleccionar...</option>
          <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</option>
          <option value="MONOTRIBUTISTA">Monotributista</option>
          <option value="EXENTO">Exento</option>
          <option value="CONSUMIDOR_FINAL">Consumidor Final</option>
        </select>
        {errors.condicionFiscal && <p className="text-red-600 text-sm mt-1">{errors.condicionFiscal.message}</p>}
      </div>

      {registrar.isError && (
        <div className="text-red-600 text-sm">
          {registrar.error.response?.data?.error?.message || 'Error al registrarse'}
        </div>
      )}

      {registrar.isSuccess && (
        <div className="text-aut-verde text-sm">
          Registro exitoso. AUT revisará tu solicitud y te notificará por email.
        </div>
      )}

      <button type="submit" disabled={registrar.isPending}
              className="w-full bg-aut-verde text-white py-3 rounded-lg font-medium disabled:opacity-50">
        {registrar.isPending ? 'Enviando...' : 'Registrarme'}
      </button>

      <p className="text-sm text-center text-gray-600">
        ¿Ya tenés cuenta? <Link to="/login" className="text-aut-verde font-medium">Ingresá</Link>
      </p>
    </form>
  );
}
