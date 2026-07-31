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
        {stock.map((s) => (
          <tr key={s.productoId} className="border-b">
            <td className="py-2 px-3 text-sm">{s.nombreProducto}</td>
            <td className={`py-2 px-3 text-sm text-right font-semibold ${s.stockActual <= 0 ? 'text-red-600' : ''}`}>
              {s.stockActual.toLocaleString('es-AR')}
            </td>
            <td className="py-2 px-3 text-sm">{s.unidadMedida}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
