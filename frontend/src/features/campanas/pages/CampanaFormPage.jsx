import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { campanasApi } from '../api/campanas.api';
import { productosApi } from '../../productos/api/productos.api';
import { BackButton } from '../../../components/BackButton';

const TIPOS = ['COLECTIVA', 'DIRECTA', 'CONTINUA'];

function paraInputDatetime(fecha) {
  if (!fecha) return '';
  return new Date(fecha).toISOString().slice(0, 16);
}

const schema = z.object({
  productoId: z.coerce.number().int().positive('Elegí un producto'),
  tipo: z.enum(TIPOS),
  nombre: z.string().min(3, 'Requerido').max(150),
  descripcion: z.string().optional(),
  volumenMinimo: z.coerce.number().positive().optional().or(z.literal('')),
  volumenMaximo: z.coerce.number().positive().optional().or(z.literal('')),
  fechaApertura: z.string().min(1, 'Requerido'),
  fechaCierre: z.string().optional(),
  fechaEstimadaRecepcion: z.string().optional(),
  horasLockoutEdicion: z.coerce.number().int().nonnegative().default(0)
}).refine(
  (d) => d.tipo !== 'COLECTIVA' || (d.volumenMinimo && Number(d.volumenMinimo) > 0),
  { message: 'COLECTIVA requiere volumen mínimo', path: ['volumenMinimo'] }
).refine(
  (d) => d.tipo !== 'COLECTIVA' || Boolean(d.fechaCierre),
  { message: 'COLECTIVA requiere fecha de cierre', path: ['fechaCierre'] }
);

export function CampanaFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const esEdicion = Boolean(id);

  const { data } = useQuery({
    queryKey: ['campanas', id],
    queryFn: () => campanasApi.obtener(id),
    enabled: esEdicion
  });

  const { data: productosData } = useQuery({
    queryKey: ['productos', { activo: true, limit: 100 }],
    queryFn: () => productosApi.listar({ activo: true, limit: 100 })
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'COLECTIVA', horasLockoutEdicion: 0 }
  });
  const tipo = watch('tipo');

  useEffect(() => {
    if (data?.campana) {
      const c = data.campana;
      reset({
        productoId: c.productoId,
        tipo: c.tipo,
        nombre: c.nombre,
        descripcion: c.descripcion ?? '',
        volumenMinimo: c.volumenMinimo ?? '',
        volumenMaximo: c.volumenMaximo ?? '',
        fechaApertura: paraInputDatetime(c.fechaApertura),
        fechaCierre: paraInputDatetime(c.fechaCierre),
        fechaEstimadaRecepcion: paraInputDatetime(c.fechaEstimadaRecepcion),
        horasLockoutEdicion: c.horasLockoutEdicion ?? 0
      });
    }
  }, [data, reset]);

  const guardar = useMutation({
    mutationFn: (datos) => {
      const payload = {
        ...datos,
        volumenMinimo: datos.volumenMinimo === '' ? undefined : Number(datos.volumenMinimo),
        volumenMaximo: datos.volumenMaximo === '' ? undefined : Number(datos.volumenMaximo),
        fechaCierre: datos.fechaCierre || undefined,
        fechaEstimadaRecepcion: datos.fechaEstimadaRecepcion || undefined
      };
      return esEdicion ? campanasApi.actualizar(id, payload) : campanasApi.crear(payload);
    },
    onSuccess: (respuesta) => {
      queryClient.invalidateQueries({ queryKey: ['campanas'] });
      navigate(esEdicion ? `/admin/campanas/${id}` : `/admin/campanas/${respuesta.campana.id}`);
    }
  });

  return (
    <div className="max-w-lg space-y-4">
      <BackButton to="/admin/pedidos" />
      <h2 className="text-lg font-bold">{esEdicion ? 'Editar pedido' : 'Nuevo pedido'}</h2>

      <form onSubmit={handleSubmit((datos) => guardar.mutate(datos))} className="bg-white border rounded-lg p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Tipo de proceso</label>
          <select {...register('tipo')} disabled={esEdicion} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100">
            <option value="COLECTIVA">Colectiva (junta volumen y licita)</option>
            <option value="DIRECTA">Directa (proveedor y precio ya conocidos)</option>
            <option value="CONTINUA">Continua (proceso permanente por tandas)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Producto</label>
          <select {...register('productoId')} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Seleccionar...</option>
            {productosData?.data.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {errors.productoId && <p className="text-red-600 text-xs mt-1">{errors.productoId.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input {...register('nombre')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.nombre && <p className="text-red-600 text-xs mt-1">{errors.nombre.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <textarea {...register('descripcion')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        {(tipo === 'COLECTIVA' || tipo === 'CONTINUA') && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Volumen mínimo</label>
              <input type="number" step="0.01" {...register('volumenMinimo')} className="w-full border rounded-lg px-3 py-2 text-sm" />
              {errors.volumenMinimo && <p className="text-red-600 text-xs mt-1">{errors.volumenMinimo.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Volumen máximo</label>
              <input type="number" step="0.01" {...register('volumenMaximo')} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Fecha de apertura</label>
            <input type="datetime-local" {...register('fechaApertura')} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.fechaApertura && <p className="text-red-600 text-xs mt-1">{errors.fechaApertura.message}</p>}
          </div>
          {tipo !== 'CONTINUA' && (
            <div>
              <label className="block text-sm font-medium mb-1">Fecha de cierre</label>
              <input type="datetime-local" {...register('fechaCierre')} className="w-full border rounded-lg px-3 py-2 text-sm" />
              {errors.fechaCierre && <p className="text-red-600 text-xs mt-1">{errors.fechaCierre.message}</p>}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Fecha estimada de recepción</label>
          <input type="datetime-local" {...register('fechaEstimadaRecepcion')} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Lockout de edición (horas antes del cierre)</label>
          <input type="number" {...register('horasLockoutEdicion')} className="w-full border rounded-lg px-3 py-2 text-sm" />
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
            onClick={() => navigate('/admin/pedidos')}
            className="px-4 py-2 rounded-lg text-sm font-medium border"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
