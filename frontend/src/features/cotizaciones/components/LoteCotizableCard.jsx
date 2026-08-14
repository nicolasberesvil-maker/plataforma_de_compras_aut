import { Link } from 'react-router-dom';

export function LoteCotizableCard({ lote, campanas }) {
  const todasCotizadas = campanas.every((c) => c.yaCotice);

  return (
    <Link
      to={`/proveedor/lotes/${lote.id}/cotizar`}
      className="block bg-white border-2 border-purple-200 rounded-lg p-4 active:bg-gray-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-medium bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">Lote</span>
          <p className="font-medium mt-1">{lote.nombre}</p>
          <p className="text-sm text-gray-600">{campanas.length} productos</p>
        </div>
        {todasCotizadas && (
          <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full whitespace-nowrap">
            Ya cotizaste
          </span>
        )}
      </div>
      <ul className="text-sm text-gray-600 mt-2 space-y-0.5">
        {campanas.map((c) => (
          <li key={c.id}>
            {c.producto?.nombre} — {c.volumenConsolidado} {c.producto?.unidadMedida?.toLowerCase()}
          </li>
        ))}
      </ul>
    </Link>
  );
}
