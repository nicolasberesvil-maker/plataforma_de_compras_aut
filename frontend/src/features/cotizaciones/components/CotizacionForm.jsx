import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cotizacionesApi } from '../api/cotizaciones.api';

const schema = z.object({
  precioUnitario: z.coerce.number().positive('Ingresá un precio mayor a 0'),
  monedaPrecio: z.enum(['ARS', 'USD']),
  plazoEntregaDias: z.coerce.number().int().positive('Ingresá los días de plazo'),
  tasaInteresMensual: z.coerce.number().min(0).max(50).optional(),
  condicionesPago: z.string().min(5, 'Describí las condiciones de pago'),
  observaciones: z.string().optional(),
  validaHasta: z.string().min(1, 'Elegí hasta cuándo es válida')
});

export function CotizacionForm({ campana, cotizacionExistente, onGuardado }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: cotizacionExistente
      ? {
          precioUnitario: Number(cotizacionExistente.precioUnitario),
          monedaPrecio: cotizacionExistente.monedaPrecio,
          plazoEntregaDias: cotizacionExistente.plazoEntregaDias,
          tasaInteresMensual: cotizacionExistente.tasaInteresMensual ? Number(cotizacionExistente.tasaInteresMensual) : undefined,
          condicionesPago: cotizacionExistente.condicionesPago,
          observaciones: cotizacionExistente.observaciones || '',
          validaHasta: cotizacionExistente.validaHasta?.slice(0, 10) || ''
        }
      : { monedaPrecio: 'ARS' }
  });

  const mutation = useMutation({
    mutationFn: (datos) => cotizacionExistente
      ? cotizacionesApi.actualizar(cotizacionExistente.id, datos)
      : cotizacionesApi.crear({ ...datos, campanaId: campana.id }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      onGuardado?.(data);
    }
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 p-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold">{campana.producto.nombre}</h3>
        <p className="text-sm">Volumen consolidado: <strong>{campana.volumenConsolidado} {campana.producto.unidadMedida.toLowerCase()}</strong></p>
        <p className="text-sm">Productores agrupados: {campana.cantidadProductores}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Precio unitario</label>
          <input {...register('precioUnitario')} type="number" step="0.0001" className="w-full px-3 py-2 border rounded" />
          {errors.precioUnitario && <p className="text-red-600 text-xs mt-1">{errors.precioUnitario.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Moneda</label>
          <select {...register('monedaPrecio')} className="w-full px-3 py-2 border rounded">
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Plazo entrega (días)</label>
        <input {...register('plazoEntregaDias')} type="number" className="w-full px-3 py-2 border rounded" />
        {errors.plazoEntregaDias && <p className="text-red-600 text-xs mt-1">{errors.plazoEntregaDias.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">% de interés mensual (financiado, opcional)</label>
        <input {...register('tasaInteresMensual')} type="number" step="0.1"
               placeholder="Ej: 1.5" className="w-full px-3 py-2 border rounded" />
        <p className="text-xs text-gray-500 mt-1">Dejalo vacío si solo vendés de contado.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Condiciones de pago</label>
        <textarea {...register('condicionesPago')} rows={3} className="w-full px-3 py-2 border rounded"
                  placeholder="Ej: 30 días contra factura, sin anticipo" />
        {errors.condicionesPago && <p className="text-red-600 text-xs mt-1">{errors.condicionesPago.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Válida hasta</label>
        <input {...register('validaHasta')} type="date" className="w-full px-3 py-2 border rounded" />
        {errors.validaHasta && <p className="text-red-600 text-xs mt-1">{errors.validaHasta.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Observaciones (opcional)</label>
        <textarea {...register('observaciones')} rows={2} className="w-full px-3 py-2 border rounded" />
      </div>

      {mutation.isError && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {mutation.error.response?.data?.error?.message || 'Error al guardar la cotización'}
        </div>
      )}

      <button type="submit" disabled={mutation.isPending}
              className="w-full bg-aut-verde text-white py-3 rounded-lg font-medium disabled:opacity-50">
        {mutation.isPending ? 'Guardando...' : cotizacionExistente ? 'Actualizar cotización' : 'Enviar cotización'}
      </button>
    </form>
  );
}
