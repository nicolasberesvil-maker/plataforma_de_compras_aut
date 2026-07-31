import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { stockApi } from '../api/stock.api';
import { depositosApi } from '../api/depositos.api';
import { ProductoSelect } from './ProductoSelect';

const schema = z.object({
  productoId: z.coerce.number().int().positive('Elegí un producto'),
  depositoDestinoId: z.coerce.number().int().positive('Elegí un depósito destino'),
  cantidad: z.coerce.number().positive('Debe ser mayor a 0'),
  observaciones: z.string().optional()
});

export function RegistrarTransferenciaForm({ depositoId }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const { data } = useQuery({
    queryKey: ['depositos', { activo: true }],
    queryFn: () => depositosApi.listar({ activo: true })
  });
  const destinos = data?.data.filter((d) => d.id !== depositoId) ?? [];

  const registrar = useMutation({
    mutationFn: (datos) => stockApi.registrarTransferencia({ ...datos, depositoOrigenId: depositoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movimientos'] });
      reset();
    }
  });

  return (
    <form onSubmit={handleSubmit((datos) => registrar.mutate(datos))} className="space-y-3">
      <ProductoSelect register={register} name="productoId" />
      {errors.productoId && <p className="text-red-600 text-xs">{errors.productoId.message}</p>}

      <select {...register('depositoDestinoId')} className="w-full border rounded-lg px-3 py-2 text-sm">
        <option value="">Depósito destino</option>
        {destinos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
      </select>
      {errors.depositoDestinoId && <p className="text-red-600 text-xs">{errors.depositoDestinoId.message}</p>}

      <input type="number" step="0.01" placeholder="Cantidad" {...register('cantidad')} className="w-full border rounded-lg px-3 py-2 text-sm" />
      {errors.cantidad && <p className="text-red-600 text-xs">{errors.cantidad.message}</p>}

      <textarea placeholder="Observaciones (opcional)" rows={2} {...register('observaciones')} className="w-full border rounded-lg px-3 py-2 text-sm" />

      {registrar.isError && (
        <p className="text-red-600 text-xs">{registrar.error.response?.data?.error?.message || 'Error al registrar la transferencia'}</p>
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
