import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { stockApi } from '../api/stock.api';
import { ProductoSelect } from './ProductoSelect';

const schema = z.object({
  productoId: z.coerce.number().int().positive('Elegí un producto'),
  cantidad: z.coerce.number().positive('Debe ser mayor a 0'),
  proveedorOrigen: z.string().optional(),
  observaciones: z.string().optional()
});

export function RegistrarIngresoForm({ depositoId }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const registrar = useMutation({
    mutationFn: (datos) => stockApi.registrarIngreso({ ...datos, depositoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depositos', depositoId, 'stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movimientos'] });
      reset();
    }
  });

  return (
    <form onSubmit={handleSubmit((datos) => registrar.mutate(datos))} className="space-y-3">
      <ProductoSelect register={register} name="productoId" />
      {errors.productoId && <p className="text-red-600 text-xs">{errors.productoId.message}</p>}

      <input type="number" step="0.01" placeholder="Cantidad" {...register('cantidad')} className="w-full border rounded-lg px-3 py-2 text-sm" />
      {errors.cantidad && <p className="text-red-600 text-xs">{errors.cantidad.message}</p>}

      <input placeholder="Proveedor de origen (opcional)" {...register('proveedorOrigen')} className="w-full border rounded-lg px-3 py-2 text-sm" />
      <textarea placeholder="Observaciones (opcional)" rows={2} {...register('observaciones')} className="w-full border rounded-lg px-3 py-2 text-sm" />

      {registrar.isError && (
        <p className="text-red-600 text-xs">{registrar.error.response?.data?.error?.message || 'Error al registrar el ingreso'}</p>
      )}

      <button
        type="submit"
        disabled={registrar.isPending}
        className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {registrar.isPending ? 'Registrando...' : 'Registrar ingreso'}
      </button>
    </form>
  );
}
