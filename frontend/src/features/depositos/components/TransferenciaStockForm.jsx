import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { stockApi } from '../api/stock.api';
import { depositosApi } from '../api/depositos.api';
import { ProductoSelect } from './ProductoSelect';

const schema = z
  .object({
    depositoOrigenId: z.coerce.number().int().positive('Elegí un depósito origen'),
    depositoDestinoId: z.coerce.number().int().positive('Elegí un depósito destino'),
    productoId: z.coerce.number().int().positive('Elegí un producto'),
    cantidad: z.coerce.number().positive('Debe ser mayor a 0'),
    observaciones: z.string().optional()
  })
  .refine((d) => d.depositoOrigenId !== d.depositoDestinoId, {
    message: 'Origen y destino no pueden ser iguales',
    path: ['depositoDestinoId']
  });

export function TransferenciaStockForm() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const { data } = useQuery({
    queryKey: ['depositos', { activo: true }],
    queryFn: () => depositosApi.listar({ activo: true })
  });

  const registrar = useMutation({
    mutationFn: (datos) => stockApi.registrarTransferencia(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movimientos'] });
      reset();
    }
  });

  return (
    <form onSubmit={handleSubmit((datos) => registrar.mutate(datos))} className="bg-white border rounded-lg p-4 space-y-3 max-w-md">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Depósito origen</label>
          <select {...register('depositoOrigenId')} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Elegir...</option>
            {data?.data.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          {errors.depositoOrigenId && <p className="text-red-600 text-xs mt-1">{errors.depositoOrigenId.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Depósito destino</label>
          <select {...register('depositoDestinoId')} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Elegir...</option>
            {data?.data.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          {errors.depositoDestinoId && <p className="text-red-600 text-xs mt-1">{errors.depositoDestinoId.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Producto</label>
        <ProductoSelect register={register} name="productoId" />
        {errors.productoId && <p className="text-red-600 text-xs mt-1">{errors.productoId.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Cantidad</label>
        <input type="number" step="0.01" {...register('cantidad')} className="w-full border rounded-lg px-3 py-2 text-sm" />
        {errors.cantidad && <p className="text-red-600 text-xs mt-1">{errors.cantidad.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Observaciones</label>
        <textarea rows={2} {...register('observaciones')} className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      {registrar.isError && (
        <p className="text-red-600 text-sm">{registrar.error.response?.data?.error?.message || 'Error al registrar la transferencia'}</p>
      )}

      <button
        type="submit"
        disabled={registrar.isPending}
        className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {registrar.isPending ? 'Registrando...' : 'Registrar transferencia'}
      </button>
    </form>
  );
}
