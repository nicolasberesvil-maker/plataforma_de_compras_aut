export function FiltrosFechas({ filtros, onChange }) {
  return (
    <div className="bg-gray-50 border rounded-lg p-3 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Desde</label>
        <input
          type="date" value={filtros.desde}
          onChange={(e) => onChange({ ...filtros, desde: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Hasta</label>
        <input
          type="date" value={filtros.hasta}
          onChange={(e) => onChange({ ...filtros, hasta: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>
      {(filtros.desde || filtros.hasta) && (
        <button onClick={() => onChange({ desde: '', hasta: '' })} className="text-sm text-aut-naranja font-medium">
          Limpiar
        </button>
      )}
    </div>
  );
}
