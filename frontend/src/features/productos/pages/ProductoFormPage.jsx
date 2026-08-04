import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { productosApi } from '../api/productos.api';

const CATEGORIAS = ['AGROQUIMICO', 'FERTILIZANTE', 'SEMILLA', 'INOCULANTE', 'NUTRICION_ANIMAL', 'SANIDAD_ANIMAL', 'OTRO'];
const UNIDADES = ['LITRO', 'KILO', 'UNIDAD', 'TONELADA', 'BOLSA'];

// Convierte '' (input vacío) a undefined ANTES de validar — si se hiciera con
// z.coerce.number() directo, Number('') da 0, que pasa .nonnegative() y el
// campo quedaría guardado como 0 en vez de quedar sin definir.
const numeroOpcional = (validador) => z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
  validador.optional()
);

const schema = z.object({
  nombre: z.string().min(2, 'Requerido'),
  descripcion: z.string().optional(),
  categoria: z.enum(CATEGORIAS),
  unidadMedida: z.enum(UNIDADES),
  alicuotaIva: z.coerce.number().positive('Debe ser mayor a 0').max(50),
  costoReferencia: numeroOpcional(z.number().positive('Debe ser mayor a 0')),
  stockMinimo: numeroOpcional(z.number().nonnegative('No puede ser negativo')),
  stockSeguridad: numeroOpcional(z.number().nonnegative('No puede ser negativo'))
});

export function ProductoFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const esEdicion = Boolean(id);

  const { data } = useQuery({
    queryKey: ['productos', id],
    queryFn: () => productosApi.obtener(id),
    enabled: esEdicion
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (data?.producto) {
      const { nombre, descripcion, categoria, unidadMedida, alicuotaIva, costoReferencia, stockMinimo, stockSeguridad } = data.producto;
      reset({
        nombre, descripcion: descripcion ?? '', categoria, unidadMedida, alicuotaIva: Number(alicuotaIva),
        costoReferencia: costoReferencia != null ? Number(costoReferencia) : undefined,
        stockMinimo: stockMinimo != null ? Number(stockMinimo) : undefined,
        stockSeguridad: stockSeguridad != null ? Number(stockSeguridad) : undefined
      });
    }
  }, [data, reset]);

  const guardar = useMutation({
    mutationFn: (datos) => (esEdicion ? productosApi.actualizar(id, datos) : productosApi.crear(datos)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      navigate('/admin/productos');
    }
  });

  return (
    <div className="max-w-lg space-y-4">
      <h2 className="text-lg font-bold">{esEdicion ? 'Editar producto' : 'Nuevo producto'}</h2>

      <form onSubmit={handleSubmit((datos) => guardar.mutate(datos))} className="bg-white border rounded-lg p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input {...register('nombre')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.nombre && <p className="text-red-600 text-xs mt-1">{errors.nombre.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <textarea {...register('descripcion')} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Categoría</label>
            <select {...register('categoria')} className="w-full border rounded-lg px-3 py-2 text-sm">
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Unidad de medida</label>
            <select {...register('unidadMedida')} className="w-full border rounded-lg px-3 py-2 text-sm">
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Alícuota IVA (%)</label>
          <input type="number" step="0.1" {...register('alicuotaIva')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.alicuotaIva && <p className="text-red-600 text-xs mt-1">{errors.alicuotaIva.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Costo de referencia</label>
          <input type="number" step="0.01" {...register('costoReferencia')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <p className="text-xs text-gray-500 mt-1">Precio de referencia individual/minorista. Opcional, se usa para pre-cargar la adjudicación.</p>
          {errors.costoReferencia && <p className="text-red-600 text-xs mt-1">{errors.costoReferencia.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Stock mínimo</label>
            <input type="number" step="0.01" {...register('stockMinimo')} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.stockMinimo && <p className="text-red-600 text-xs mt-1">{errors.stockMinimo.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stock de seguridad</label>
            <input type="number" step="0.01" {...register('stockSeguridad')} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.stockSeguridad && <p className="text-red-600 text-xs mt-1">{errors.stockSeguridad.message}</p>}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={guardar.isPending}
            className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {guardar.isPending ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/productos')}
            className="px-4 py-2 rounded-lg text-sm font-medium border"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
