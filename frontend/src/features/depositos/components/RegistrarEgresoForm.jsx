import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { stockApi } from '../api/stock.api';
import { ProductoSelect } from './ProductoSelect';
import { productoresApi } from '../../usuarios/api/productores.api';

const schema = z.object({
  productoId: z.coerce.number().int().positive('Elegí un producto'),
  productorId: z.coerce.number().int().positive('Elegí el comprador'),
  cantidad: z.coerce.number().positive('Debe ser mayor a 0'),
  observaciones: z.string().optional()
});

export function RegistrarEgresoForm({ depositoId }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const { data: productoresData } = useQuery({
    queryKey: ['productores', 'para-egreso'],
    queryFn: () => productoresApi.listar({ limit: 200 })
  });

  const registrar = useMutation({
    mutationFn: (datos) => stockApi.registrarEgreso({ ...datos, depositoId }),
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

      <select {...register('productorId')} className="w-full border rounded-lg px-3 py-2 text-sm">
        <option value="">Elegí el comprador</option>
        {productoresData?.data.map((p) => <option key={p.id} value={p.id}>{p.razonSocial}</option>)}
      </select>
      {errors.productorId && <p className="text-red-600 text-xs">{errors.productorId.message}</p>}

      <input type="number" step="0.01" placeholder="Cantidad" {...register('cantidad')} className="w-full border rounded-lg px-3 py-2 text-sm" />
      {errors.cantidad && <p className="text-red-600 text-xs">{errors.cantidad.message}</p>}

      <textarea placeholder="Observaciones (opcional)" rows={2} {...register('observaciones')} className="w-full border rounded-lg px-3 py-2 text-sm" />

      {registrar.isError && (
        <p className="text-red-600 text-xs">{registrar.error.response?.data?.error?.message || 'Error al registrar el egreso'}</p>
      )}

      <button
        type="submit"
        disabled={registrar.isPending}
        className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {registrar.isPending ? 'Registrando...' : 'Registrar egreso'}
      </button>
    </form>
  );
}
