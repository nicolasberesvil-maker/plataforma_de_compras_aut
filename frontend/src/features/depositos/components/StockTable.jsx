import { AlertTriangle } from 'lucide-react';

function nivelAlerta(s) {
  if (s.stockSeguridad != null && s.stockActual < s.stockSeguridad) return 'critico';
  if (s.stockMinimo != null && s.stockActual < s.stockMinimo) return 'advertencia';
  return null;
}

export function StockTable({ stock }) {
  if (!stock || stock.length === 0) {
    return <p className="text-sm text-gray-500">Sin movimientos de stock registrados.</p>;
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b text-left text-xs text-gray-500 uppercase">
          <th className="py-2 px-3">Producto</th>
          <th className="py-2 px-3 text-right">Stock actual</th>
          <th className="py-2 px-3">Unidad</th>
        </tr>
      </thead>
      <tbody>
        {stock.map((s) => {
          const alerta = nivelAlerta(s);
          return (
            <tr key={s.productoId} className="border-b">
              <td className="py-2 px-3 text-sm">{s.nombreProducto}</td>
              <td
                className={`py-2 px-3 text-sm text-right font-semibold ${
                  s.stockActual <= 0 || alerta === 'critico' ? 'text-red-600' : alerta === 'advertencia' ? 'text-amber-600' : ''
                }`}
              >
                <span className="inline-flex items-center gap-1 justify-end">
                  {alerta && (
                    <AlertTriangle
                      size={14}
                      className="shrink-0"
                      aria-label={alerta === 'critico' ? 'Por debajo del stock de seguridad' : 'Por debajo del stock mínimo'}
                    />
                  )}
                  {s.stockActual.toLocaleString('es-AR')}
                </span>
              </td>
              <td className="py-2 px-3 text-sm">{s.unidadMedida}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
