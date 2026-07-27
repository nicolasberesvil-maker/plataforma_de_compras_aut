import { CategoriaBadge } from './CategoriaBadge';

export function ProductoCard({ producto }) {
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm">{producto.nombre}</h3>
        <CategoriaBadge categoria={producto.categoria} />
      </div>
      <p className="text-xs text-gray-500">Unidad: {producto.unidadMedida}</p>
      {producto.descripcion && <p className="text-xs text-gray-600">{producto.descripcion}</p>}
    </div>
  );
}
