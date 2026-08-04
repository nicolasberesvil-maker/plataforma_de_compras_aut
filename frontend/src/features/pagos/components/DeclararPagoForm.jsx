import { useState } from 'react';

const MEDIOS_PAGO = ['TRANSFERENCIA', 'ECHEQ_CORRIENTE', 'ECHEQ_PLAZO', 'TARJETA_AGRO', 'CANJE_CEREAL', 'CUENTA_CORRIENTE', 'EFECTIVO'];

function formatearMoneda(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

export function DeclararPagoForm({ ordenes, onSubmit, isLoading, error }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState('');
  const [aplicaciones, setAplicaciones] = useState({}); // { [ordenCompraId]: montoString }
  const [medios, setMedios] = useState([{ formaPago: 'TRANSFERENCIA', monto: '' }]);
  const [errorLocal, setErrorLocal] = useState('');

  function toggleOrden(orden) {
    setAplicaciones((prev) => {
      const copia = { ...prev };
      if (copia[orden.ordenCompraId] !== undefined) {
        delete copia[orden.ordenCompraId];
      } else {
        copia[orden.ordenCompraId] = String(orden.montoPendiente);
      }
      return copia;
    });
  }

  function actualizarMontoOrden(ordenId, valor) {
    setAplicaciones((prev) => ({ ...prev, [ordenId]: valor }));
  }

  function actualizarMedio(index, campo, valor) {
    setMedios((prev) => prev.map((m, i) => (i === index ? { ...m, [campo]: valor } : m)));
  }

  function agregarMedio() {
    setMedios((prev) => [...prev, { formaPago: 'TRANSFERENCIA', monto: '' }]);
  }

  function quitarMedio(index) {
    setMedios((prev) => prev.filter((_, i) => i !== index));
  }

  const totalAplicado = Object.values(aplicaciones).reduce((acc, v) => acc + (Number(v) || 0), 0);
  const totalMedios = medios.reduce((acc, m) => acc + (Number(m.monto) || 0), 0);

  function handleSubmit(e) {
    e.preventDefault();
    setErrorLocal('');

    const aplicacionesArray = Object.entries(aplicaciones)
      .filter(([, monto]) => Number(monto) > 0)
      .map(([ordenCompraId, montoAplicado]) => ({ ordenCompraId: Number(ordenCompraId), montoAplicado: Number(montoAplicado) }));

    const mediosArray = medios
      .filter((m) => Number(m.monto) > 0)
      .map((m) => ({ formaPago: m.formaPago, monto: Number(m.monto) }));

    if (aplicacionesArray.length === 0) {
      setErrorLocal('Elegí al menos una orden');
      return;
    }
    if (mediosArray.length === 0) {
      setErrorLocal('Elegí al menos un medio de pago');
      return;
    }
    if (Math.abs(totalAplicado - totalMedios) > 0.01) {
      setErrorLocal(`Los medios de pago (${formatearMoneda(totalMedios)}) no coinciden con lo aplicado a órdenes (${formatearMoneda(totalAplicado)})`);
      return;
    }

    onSubmit({ fecha, observaciones: observaciones || undefined, aplicaciones: aplicacionesArray, medios: mediosArray });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border rounded-lg p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Fecha</label>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      <div>
        <p className="text-sm font-medium mb-2">¿A qué órdenes aplica?</p>
        {ordenes.length === 0 ? (
          <p className="text-sm text-gray-500">No tenés órdenes pendientes de pago.</p>
        ) : (
          <div className="space-y-2">
            {ordenes.map((orden) => (
              <div key={orden.ordenCompraId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={aplicaciones[orden.ordenCompraId] !== undefined}
                  onChange={() => toggleOrden(orden)}
                />
                <span className="flex-1">{orden.producto} — pendiente {formatearMoneda(orden.montoPendiente)}</span>
                {aplicaciones[orden.ordenCompraId] !== undefined && (
                  <input
                    type="number"
                    step="0.01"
                    value={aplicaciones[orden.ordenCompraId]}
                    onChange={(e) => actualizarMontoOrden(orden.ordenCompraId, e.target.value)}
                    className="w-28 border rounded-lg px-2 py-1 text-sm text-right"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Medios de pago</p>
        <div className="space-y-2">
          {medios.map((medio, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={medio.formaPago}
                onChange={(e) => actualizarMedio(i, 'formaPago', e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              >
                {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Monto"
                value={medio.monto}
                onChange={(e) => actualizarMedio(i, 'monto', e.target.value)}
                className="w-28 border rounded-lg px-2 py-1 text-sm text-right"
              />
              {medios.length > 1 && (
                <button type="button" onClick={() => quitarMedio(i)} className="text-red-600 text-sm">✕</button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={agregarMedio} className="text-sm text-aut-verde font-medium mt-2">
          + Agregar medio de pago
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Observaciones</label>
        <textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      {(errorLocal || error) && <p className="text-red-600 text-sm">{errorLocal || error}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {isLoading ? 'Declarando...' : 'Declarar pago'}
      </button>
    </form>
  );
}
