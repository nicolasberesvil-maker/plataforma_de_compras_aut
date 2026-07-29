import { useState } from 'react';

export function ConfirmarAdjudicacionModal({ cotizacion, campana, onCancelar, onConfirmar, pending }) {
  const [precioMinoristaReferencia, setPrecioMinoristaReferencia] = useState('');
  const [motivoEleccion, setMotivoEleccion] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
      <div className="bg-white rounded-lg p-5 max-w-md w-full space-y-3">
        <h3 className="font-bold">Confirmar adjudicación</h3>
        <p className="text-sm text-gray-600">
          Vas a adjudicar <strong>{campana.nombre}</strong> a <strong>{cotizacion.proveedor.razonSocial}</strong> a{' '}
          {cotizacion.monedaPrecio} {cotizacion.precioUnitario.toFixed(4)} por unidad.
        </p>

        <div>
          <label className="text-xs text-gray-500">Precio minorista de referencia (opcional, para calcular ahorro)</label>
          <input
            type="number" step="0.01" value={precioMinoristaReferencia}
            onChange={(e) => setPrecioMinoristaReferencia(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Motivo de elección (opcional)</label>
          <textarea
            value={motivoEleccion} onChange={(e) => setMotivoEleccion(e.target.value)} rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-sm font-medium border">Cancelar</button>
          <button
            disabled={pending}
            onClick={() => onConfirmar({
              campanaId: campana.id,
              cotizacionGanadoraId: cotizacion.id,
              precioMinoristaReferencia: precioMinoristaReferencia ? Number(precioMinoristaReferencia) : undefined,
              motivoEleccion: motivoEleccion || undefined
            })}
            className="bg-aut-verde text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {pending ? 'Adjudicando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
