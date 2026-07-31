import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { depositosApi } from '../api/depositos.api';

const schema = z.object({
  nombre: z.string().min(2, 'Requerido'),
  localidad: z.string().min(2, 'Requerido'),
  direccion: z.string().min(2, 'Requerido'),
  responsable: z.string().optional(),
  telefonoContacto: z.string().optional(),
  horarioAtencion: z.string().optional(),
  capacidadMaxima: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.coerce.number().positive().optional()
  )
});

export function DepositoFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const esEdicion = Boolean(id);

  const { data } = useQuery({
    queryKey: ['depositos', id],
    queryFn: () => depositosApi.obtener(id),
    enabled: esEdicion
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (data?.deposito) {
      const { nombre, localidad, direccion, responsable, telefonoContacto, horarioAtencion, capacidadMaxima } = data.deposito;
      reset({
        nombre, localidad, direccion,
        responsable: responsable ?? '',
        telefonoContacto: telefonoContacto ?? '',
        horarioAtencion: horarioAtencion ?? '',
        capacidadMaxima: capacidadMaxima ? Number(capacidadMaxima) : ''
      });
    }
  }, [data, reset]);

  const guardar = useMutation({
    mutationFn: (datos) => (esEdicion ? depositosApi.actualizar(id, datos) : depositosApi.crear(datos)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depositos'] });
      navigate('/admin/depositos');
    }
  });

  return (
    <div className="max-w-lg space-y-4">
      <h2 className="text-lg font-bold">{esEdicion ? 'Editar depósito' : 'Nuevo depósito'}</h2>

      <form onSubmit={handleSubmit((datos) => guardar.mutate(datos))} className="bg-white border rounded-lg p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input {...register('nombre')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.nombre && <p className="text-red-600 text-xs mt-1">{errors.nombre.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Localidad</label>
            <input {...register('localidad')} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.localidad && <p className="text-red-600 text-xs mt-1">{errors.localidad.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Dirección</label>
            <input {...register('direccion')} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.direccion && <p className="text-red-600 text-xs mt-1">{errors.direccion.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Responsable</label>
            <input {...register('responsable')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Teléfono de contacto</label>
            <input {...register('telefonoContacto')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Horario de atención</label>
            <input {...register('horarioAtencion')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Capacidad máxima</label>
            <input type="number" step="0.01" {...register('capacidadMaxima')} className="w-full border rounded-lg px-3 py-2 text-sm" />
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
            onClick={() => navigate('/admin/depositos')}
            className="px-4 py-2 rounded-lg text-sm font-medium border"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
