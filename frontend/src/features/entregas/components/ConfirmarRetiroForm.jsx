import { useState } from 'react';

export function ConfirmarRetiroForm({ onConfirmar, onCancelar, cargando, error }) {
  const [recibidaPorNombre, setRecibidaPorNombre] = useState('');
  const [recibidaPorDni, setRecibidaPorDni] = useState('');
  const [observaciones, setObservaciones] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onConfirmar({ recibidaPorNombre, recibidaPorDni, observaciones: observaciones || undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border rounded-lg p-3 space-y-2 text-sm">
      <div className="grid sm:grid-cols-2 gap-2">
        <input
          value={recibidaPorNombre}
          onChange={(e) => setRecibidaPorNombre(e.target.value)}
          placeholder="Nombre de quien retira"
          required
          className="border rounded-lg px-3 py-2"
        />
        <input
          value={recibidaPorDni}
          onChange={(e) => setRecibidaPorDni(e.target.value)}
          placeholder="DNI"
          required
          className="border rounded-lg px-3 py-2"
        />
      </div>
      <input
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
        placeholder="Observaciones (opcional)"
        className="border rounded-lg px-3 py-2 w-full"
      />

      {error && <p className="text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={cargando}
          className="bg-aut-verde text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {cargando ? 'Confirmando...' : 'Confirmar'}
        </button>
        <button type="button" onClick={onCancelar} className="text-gray-600 px-4 py-2">
          Cancelar
        </button>
      </div>
    </form>
  );
}
