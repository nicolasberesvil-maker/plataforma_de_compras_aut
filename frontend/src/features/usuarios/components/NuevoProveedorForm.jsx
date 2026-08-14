import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const CONDICIONES_FISCALES = ['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'EXENTO', 'CONSUMIDOR_FINAL'];

const schema = z.object({
  username: z.string().min(3, 'Mínimo 3 caracteres'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  email: z.string().email('Email inválido'),
  nombre: z.string().min(2, 'Requerido'),
  apellido: z.string().min(2, 'Requerido'),
  telefono: z.string().optional(),
  razonSocial: z.string().min(2, 'Requerido'),
  cuit: z.string().regex(/^\d{11}$/, 'CUIT debe tener 11 dígitos'),
  condicionFiscal: z.enum(CONDICIONES_FISCALES),
  domicilioFiscal: z.string().min(5, 'Requerido')
});

export function NuevoProveedorForm({ onSubmit, isLoading, resultado }) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm({ resolver: zodResolver(schema) });

  return (
    <form
      onSubmit={handleSubmit((datos) => onSubmit(datos, reset))}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Usuario</label>
          <input {...register('username')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.username && <p className="text-red-600 text-xs mt-1">{errors.username.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input {...register('password')} type="text" className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input {...register('email')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input {...register('nombre')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.nombre && <p className="text-red-600 text-xs mt-1">{errors.nombre.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Apellido</label>
          <input {...register('apellido')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.apellido && <p className="text-red-600 text-xs mt-1">{errors.apellido.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <input {...register('telefono')} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">CUIT</label>
          <input {...register('cuit')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.cuit && <p className="text-red-600 text-xs mt-1">{errors.cuit.message}</p>}
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Razón social</label>
          <input {...register('razonSocial')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.razonSocial && <p className="text-red-600 text-xs mt-1">{errors.razonSocial.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Condición fiscal</label>
          <select {...register('condicionFiscal')} className="w-full border rounded-lg px-3 py-2 text-sm">
            {CONDICIONES_FISCALES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Domicilio fiscal</label>
          <input {...register('domicilioFiscal')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.domicilioFiscal && <p className="text-red-600 text-xs mt-1">{errors.domicilioFiscal.message}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {isLoading ? 'Creando...' : 'Crear proveedor'}
      </button>

      {resultado && (
        <p className="text-sm text-aut-verde">
          Proveedor creado con usuario <code className="bg-gray-100 px-1 rounded">{resultado.usuario?.username}</code>.
          Comunicale la contraseña por fuera del sistema.
        </p>
      )}
    </form>
  );
}
