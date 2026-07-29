import { Link } from 'react-router-dom';

export function CampanaCotizableCard({ campana }) {
  return (
    <Link
      to={`/proveedor/campanas/${campana.id}/cotizar`}
      className="block bg-white border rounded-lg p-4 active:bg-gray-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{campana.nombre}</p>
          <p className="text-sm text-gray-600">{campana.producto?.nombre}</p>
        </div>
        {campana.yaCotice && (
          <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full whitespace-nowrap">
            Ya cotizaste
          </span>
        )}
      </div>
      <p className="text-sm mt-2">
        Volumen consolidado: <strong>{campana.volumenConsolidado} {campana.producto?.unidadMedida?.toLowerCase()}</strong>
      </p>
      <p className="text-xs text-gray-500">Productores agrupados: {campana.cantidadProductores}</p>
      {campana.fechaCierreCotizaciones && (
        <p className="text-xs text-gray-500 mt-1">
          Cotizá antes de: {new Date(campana.fechaCierreCotizaciones).toLocaleDateString('es-AR')}
        </p>
      )}
    </Link>
  );
}
