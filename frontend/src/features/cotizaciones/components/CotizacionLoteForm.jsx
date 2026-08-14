import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cotizacionesApi } from '../api/cotizaciones.api';

export function CotizacionLoteForm({ lote, campanas, onGuardado }) {
  const queryClient = useQueryClient();
  const [precios, setPrecios] = useState({});
  const [monedaPrecio, setMonedaPrecio] = useState('ARS');
  const [plazoEntregaDias, setPlazoEntregaDias] = useState('');
  const [tasaInteresMensual, setTasaInteresMensual] = useState('');
  const [condicionesPago, setCondicionesPago] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [validaHasta, setValidaHasta] = useState('');

  const disponibles = campanas.filter((c) => !c.yaCotice);

  const mutation = useMutation({
    mutationFn: () => cotizacionesApi.crearLote({
      items: disponibles
        .filter((c) => precios[c.id])
        .map((c) => ({ campanaId: c.id, precioUnitario: Number(precios[c.id]) })),
      monedaPrecio,
      plazoEntregaDias: Number(plazoEntregaDias),
      tasaInteresMensual: tasaInteresMensual ? Number(tasaInteresMensual) : undefined,
      condicionesPago,
      observaciones: observaciones || undefined,
      validaHasta: new Date(validaHasta).toISOString()
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      onGuardado?.(data);
    }
  });

  const cantidadCargados = disponibles.filter((c) => precios[c.id]).length;
  const puedeEnviar = cantidadCargados > 0 && plazoEntregaDias && condicionesPago.trim().length >= 5 && validaHasta;

  return (
    <div className="space-y-4 p-4">
      <div className="bg-purple-50 p-4 rounded-lg">
        <h3 className="font-semibold">{lote.nombre}</h3>
        <p className="text-sm text-gray-600">Cargá el precio de cada producto que puedas ofrecer. Las condiciones de abajo aplican a todo el lote.</p>
      </div>

      <div className="space-y-2">
        {campanas.map((c) => (
          <div key={c.id} className={`border rounded-lg p-3 ${c.yaCotice ? 'bg-gray-50' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{c.producto?.nombre}</p>
                <p className="text-xs text-gray-500">Volumen consolidado: {c.volumenConsolidado} {c.producto?.unidadMedida?.toLowerCase()}</p>
              </div>
              {c.yaCotice ? (
                <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full whitespace-nowrap shrink-0">
                  Ya cotizaste
                </span>
              ) : (
                <input
                  type="number"
                  step="0.0001"
                  placeholder="Precio unit."
                  value={precios[c.id] ?? ''}
                  onChange={(e) => setPrecios((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  className="w-32 px-3 py-2 border rounded shrink-0"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Moneda</label>
          <select value={monedaPrecio} onChange={(e) => setMonedaPrecio(e.target.value)} className="w-full px-3 py-2 border rounded">
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Plazo (días)</label>
          <input type="number" value={plazoEntregaDias} onChange={(e) => setPlazoEntregaDias(e.target.value)} className="w-full px-3 py-2 border rounded" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">% de interés mensual (financiado, opcional)</label>
        <input type="number" step="0.1" value={tasaInteresMensual} onChange={(e) => setTasaInteresMensual(e.target.value)}
               placeholder="Ej: 1.5" className="w-full px-3 py-2 border rounded" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Condiciones de pago</label>
        <textarea value={condicionesPago} onChange={(e) => setCondicionesPago(e.target.value)} rows={3} className="w-full px-3 py-2 border rounded"
                  placeholder="Ej: 30 días contra factura, sin anticipo" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Válida hasta</label>
        <input type="date" value={validaHasta} onChange={(e) => setValidaHasta(e.target.value)} className="w-full px-3 py-2 border rounded" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Observaciones (opcional)</label>
        <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded" />
      </div>

      {mutation.isError && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {mutation.error.response?.data?.error?.message || 'Error al enviar la cotización'}
        </div>
      )}

      {mutation.isSuccess && mutation.data.errores.length > 0 && (
        <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-sm space-y-1">
          <p className="font-medium">Algunos productos no se pudieron cotizar:</p>
          {mutation.data.errores.map((e) => (
            <p key={e.campanaId}>{campanas.find((c) => c.id === e.campanaId)?.producto?.nombre}: {e.motivo}</p>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={!puedeEnviar || mutation.isPending}
        className="w-full bg-aut-verde text-white py-3 rounded-lg font-medium disabled:opacity-50"
      >
        {mutation.isPending ? 'Enviando...' : `Cotizar ${cantidadCargados} producto${cantidadCargados === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}
