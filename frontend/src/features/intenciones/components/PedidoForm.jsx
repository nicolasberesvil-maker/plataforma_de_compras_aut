import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { intencionesApi } from '../api/intenciones.api';

const FORMAS_PAGO = [
  ['TRANSFERENCIA', 'Transferencia'],
  ['ECHEQ_CORRIENTE', 'E-cheq corriente'],
  ['ECHEQ_PLAZO', 'E-cheq a plazo'],
  ['TARJETA_AGRO', 'Tarjeta agro'],
  ['CANJE_CEREAL', 'Canje cereal'],
  ['CUENTA_CORRIENTE', 'Cuenta corriente con AUT'],
  ['EFECTIVO', 'Efectivo']
];

const schemaBase = {
  volumen: z.coerce.number().positive('Ingresá una cantidad mayor a 0'),
  observaciones: z.string().optional(),
  fechaDeseada: z.string().optional(),
  modalidadEntregaPreferida: z.enum(['RETIRO_EN_DEPOSITO', 'ENTREGA_EN_CAMPO']).optional(),
  // Preferencia de depósito se agrega en Fase 8 (recién ahí existe el modelo Deposito).
  direccionEntregaCampo: z.string().optional(),
  formaPagoPreferida: z.string().optional()
};

// Dentro de una campaña, fecha/modalidad son opcionales (la campaña ya da
// contexto). Como pedido suelto son obligatorias: es lo único que tiene el
// ADMIN para decidir cómo armar el requerimiento (regla D.1).
const schemaCampana = z.object(schemaBase);
const schemaSuelto = z.object({
  ...schemaBase,
  fechaDeseada: z.string().min(1, 'Elegí para cuándo lo necesitás'),
  modalidadEntregaPreferida: z.enum(['RETIRO_EN_DEPOSITO', 'ENTREGA_EN_CAMPO'], { required_error: 'Elegí cómo preferís recibirlo' })
});

export function PedidoForm({ campana, productoId, pedidoExistente, onGuardado }) {
  const queryClient = useQueryClient();
  const esSuelto = !campana;

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(esSuelto ? schemaSuelto : schemaCampana),
    defaultValues: pedidoExistente
      ? {
          volumen: Number(pedidoExistente.volumen),
          observaciones: pedidoExistente.observaciones || '',
          fechaDeseada: pedidoExistente.fechaDeseada?.slice(0, 10) || '',
          modalidadEntregaPreferida: pedidoExistente.modalidadEntregaPreferida || 'RETIRO_EN_DEPOSITO',
          direccionEntregaCampo: pedidoExistente.direccionEntregaCampo || '',
          formaPagoPreferida: pedidoExistente.formaPagoPreferida || ''
        }
      : { modalidadEntregaPreferida: 'RETIRO_EN_DEPOSITO' }
  });

  const modalidad = watch('modalidadEntregaPreferida');

  const mutation = useMutation({
    mutationFn: (datos) => {
      const payload = { ...datos, formaPagoPreferida: datos.formaPagoPreferida || undefined };
      return pedidoExistente
        ? intencionesApi.actualizar(pedidoExistente.id, payload)
        : intencionesApi.crear({ ...payload, campanaId: campana?.id, productoId: esSuelto ? productoId : undefined });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['intenciones'] });
      if (campana) queryClient.invalidateQueries({ queryKey: ['campanas', campana.id] });
      onGuardado?.(data);
    }
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5 p-4">
      <div>
        <label className="block text-base font-medium mb-2">
          ¿Cuánto necesitás?{campana?.producto?.unidadMedida ? ` (${campana.producto.unidadMedida.toLowerCase()})` : ''}
        </label>
        <input
          {...register('volumen')}
          type="number"
          inputMode="decimal"
          step="0.01"
          autoFocus
          className="w-full px-4 py-4 text-xl border-2 rounded-lg"
          placeholder="Ej: 500"
        />
        {errors.volumen && <p className="text-red-600 text-sm mt-1">{errors.volumen.message}</p>}
      </div>

      <div>
        <label className="block text-base font-medium mb-2">Cómo preferís recibirlo</label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer has-[:checked]:border-aut-verde has-[:checked]:bg-green-50">
            <input {...register('modalidadEntregaPreferida')} type="radio" value="RETIRO_EN_DEPOSITO" />
            <span>Retiro en depósito de AUT</span>
          </label>
          <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer has-[:checked]:border-aut-verde has-[:checked]:bg-green-50">
            <input {...register('modalidadEntregaPreferida')} type="radio" value="ENTREGA_EN_CAMPO" />
            <span>Entrega en mi campo</span>
          </label>
        </div>
        {errors.modalidadEntregaPreferida && <p className="text-red-600 text-sm mt-1">{errors.modalidadEntregaPreferida.message}</p>}
      </div>

      {modalidad === 'ENTREGA_EN_CAMPO' && (
        <div>
          <label className="block text-base font-medium mb-2">Dirección de entrega</label>
          <input {...register('direccionEntregaCampo')} type="text"
                 className="w-full px-4 py-3 border-2 rounded-lg text-base"
                 placeholder="Ej: Campo La Esperanza, Ruta 13 km 4" />
          {errors.direccionEntregaCampo && <p className="text-red-600 text-sm mt-1">{errors.direccionEntregaCampo.message}</p>}
        </div>
      )}

      <div>
        <label className="block text-base font-medium mb-2">
          ¿Para cuándo lo necesitás?{esSuelto ? '' : ' (opcional)'}
        </label>
        <input {...register('fechaDeseada')} type="date" className="w-full px-4 py-3 border-2 rounded-lg text-base" />
        {errors.fechaDeseada && <p className="text-red-600 text-sm mt-1">{errors.fechaDeseada.message}</p>}
      </div>

      <div>
        <label className="block text-base font-medium mb-2">¿Cómo preferís pagar? (opcional)</label>
        <select {...register('formaPagoPreferida')} className="w-full px-4 py-3 border-2 rounded-lg text-base">
          <option value="">Sin preferencia</option>
          {FORMAS_PAGO.map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-base font-medium mb-2">Observaciones (opcional)</label>
        <textarea {...register('observaciones')} rows={3}
                  className="w-full px-3 py-3 border-2 rounded-lg text-base"
                  placeholder="Ej: Para los lotes del este" />
      </div>

      {mutation.isError && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {mutation.error.response?.data?.error?.message || 'Error al guardar'}
        </div>
      )}

      <button type="submit" disabled={mutation.isPending}
              className="w-full bg-aut-verde text-white py-4 rounded-lg font-semibold text-lg disabled:opacity-50">
        {mutation.isPending ? 'Guardando...' : pedidoExistente ? 'Actualizar pedido' : esSuelto ? 'Pedir este producto' : 'Sumarme a la compra'}
      </button>
    </form>
  );
}
