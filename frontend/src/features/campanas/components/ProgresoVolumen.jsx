export function ProgresoVolumen({ acumulado, minimo, unidad }) {
  const porcentaje = minimo > 0 ? Math.min(100, Math.round((acumulado / minimo) * 100)) : 0;

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{acumulado} / {minimo} {unidad}</span>
        <span>{porcentaje}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${porcentaje >= 100 ? 'bg-aut-verde' : 'bg-aut-naranja'}`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}
