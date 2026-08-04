import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const MEDIOS_PAGO = ['TRANSFERENCIA', 'ECHEQ_CORRIENTE', 'ECHEQ_PLAZO', 'TARJETA_AGRO', 'CANJE_CEREAL', 'CUENTA_CORRIENTE', 'EFECTIVO'];

const schema = z.object({
  fecha: z.string().min(1, 'Requerido'),
  monto: z.coerce.number().positive('Debe ser mayor a 0'),
  medioPago: z.enum(MEDIOS_PAGO),
  observaciones: z.string().optional()
});

export function RegistrarPagoProveedorForm({ onSubmit, isLoading }) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { fecha: new Date().toISOString().slice(0, 10), medioPago: 'TRANSFERENCIA' }
  });

  return (
    <form
      onSubmit={handleSubmit((datos) => onSubmit(datos, reset))}
      className="border rounded-lg p-3 space-y-3 bg-gray-50"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Fecha</label>
          <input type="date" {...register('fecha')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.fecha && <p className="text-red-600 text-xs mt-1">{errors.fecha.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Monto</label>
          <input type="number" step="0.01" {...register('monto')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.monto && <p className="text-red-600 text-xs mt-1">{errors.monto.message}</p>}
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Medio de pago</label>
          <select {...register('medioPago')} className="w-full border rounded-lg px-3 py-2 text-sm">
            {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Observaciones</label>
          <input {...register('observaciones')} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {isLoading ? 'Guardando...' : 'Registrar pago'}
      </button>
    </form>
  );
}
