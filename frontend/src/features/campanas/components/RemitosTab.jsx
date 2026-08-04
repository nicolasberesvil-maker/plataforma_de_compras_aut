import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { remitosApi } from '../api/remitos.api';
import { depositosApi } from '../../depositos/api/depositos.api';
import { proveedoresApi } from '../../usuarios/api/proveedores.api';

const schema = z.object({
  proveedorId: z.coerce.number().int().positive('Requerido'),
  depositoId: z.coerce.number().int().positive('Requerido'),
  numero: z.string().min(1, 'Requerido'),
  fecha: z.string().min(1, 'Requerido'),
  cantidadRecibida: z.coerce.number().positive('Debe ser mayor a 0'),
  observaciones: z.string().optional()
});

export function RemitosTab({ campana }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['campanas', campana.id, 'remitos'],
    queryFn: () => remitosApi.listar(campana.id)
  });

  const { data: depositosData } = useQuery({
    queryKey: ['depositos'],
    queryFn: () => depositosApi.listar({})
  });

  const { data: proveedoresData } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => proveedoresApi.listar({})
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { fecha: new Date().toISOString().slice(0, 10) }
  });

  const crear = useMutation({
    mutationFn: (datos) => remitosApi.crear(campana.id, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanas', campana.id, 'remitos'] });
      reset();
      setMostrarForm(false);
    }
  });

  const remitos = data?.data ?? [];
  const puedeCargar = ['ADJUDICADA', 'CERRADA'].includes(campana.estado);

  return (
    <div className="space-y-4">
      {puedeCargar && (
        <div>
          <button onClick={() => setMostrarForm((v) => !v)} className="text-sm text-aut-verde font-medium">
            {mostrarForm ? 'Cancelar' : '+ Cargar remito'}
          </button>

          {mostrarForm && (
            <form
              onSubmit={handleSubmit((datos) => crear.mutate(datos))}
              className="bg-gray-50 border rounded-lg p-3 mt-2 space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Proveedor</label>
                  <select {...register('proveedorId')} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Elegir...</option>
                    {proveedoresData?.data.map((p) => <option key={p.id} value={p.id}>{p.razonSocial}</option>)}
                  </select>
                  {errors.proveedorId && <p className="text-red-600 text-xs mt-1">{errors.proveedorId.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Depósito</label>
                  <select {...register('depositoId')} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Elegir...</option>
                    {depositosData?.data.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                  {errors.depositoId && <p className="text-red-600 text-xs mt-1">{errors.depositoId.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Número de remito</label>
                  <input {...register('numero')} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  {errors.numero && <p className="text-red-600 text-xs mt-1">{errors.numero.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Fecha</label>
                  <input type="date" {...register('fecha')} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  {errors.fecha && <p className="text-red-600 text-xs mt-1">{errors.fecha.message}</p>}
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Cantidad recibida ({campana.producto?.unidadMedida?.toLowerCase()})
                  </label>
                  <input type="number" step="0.01" {...register('cantidadRecibida')} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  {errors.cantidadRecibida && <p className="text-red-600 text-xs mt-1">{errors.cantidadRecibida.message}</p>}
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Observaciones</label>
                  <input {...register('observaciones')} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              {crear.isError && (
                <p className="text-red-600 text-sm">{crear.error.response?.data?.error?.message || 'Error al cargar el remito'}</p>
              )}

              <button
                type="submit"
                disabled={crear.isPending}
                className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {crear.isPending ? 'Guardando...' : 'Cargar remito'}
              </button>
              <p className="text-xs text-gray-500">Al cargarlo se genera automáticamente el ingreso de stock en el depósito elegido.</p>
            </form>
          )}
        </div>
      )}

      {!puedeCargar && (
        <p className="text-sm text-gray-500">Los remitos se cargan una vez adjudicada la compra.</p>
      )}

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : remitos.length === 0 ? (
        <p className="text-sm text-gray-500">Sin remitos cargados.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500 uppercase">
                <th className="py-2 px-3">Número</th>
                <th className="py-2 px-3">Fecha</th>
                <th className="py-2 px-3">Proveedor</th>
                <th className="py-2 px-3">Depósito</th>
                <th className="py-2 px-3 text-right">Cantidad</th>
                <th className="py-2 px-3">Registrado por</th>
              </tr>
            </thead>
            <tbody>
              {remitos.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 px-3 text-sm">{r.numero}</td>
                  <td className="py-2 px-3 text-sm text-gray-600">{new Date(r.fecha).toLocaleDateString('es-AR')}</td>
                  <td className="py-2 px-3 text-sm">{r.proveedor?.razonSocial}</td>
                  <td className="py-2 px-3 text-sm">{r.deposito?.nombre}</td>
                  <td className="py-2 px-3 text-sm text-right">{Number(r.cantidadRecibida).toLocaleString('es-AR')}</td>
                  <td className="py-2 px-3 text-sm text-gray-600">{r.registradoPor?.nombre} {r.registradoPor?.apellido}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
