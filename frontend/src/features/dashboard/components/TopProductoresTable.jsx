export function TopProductoresTable({ data }) {
  return (
    <div className="bg-white rounded-lg border overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-xs text-gray-500 uppercase">
            <th className="py-2 px-3">Productor</th>
            <th className="py-2 px-3">Total comprado</th>
            <th className="py-2 px-3">Volumen</th>
            <th className="py-2 px-3">Órdenes</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((p) => (
            <tr key={p.productorId} className="border-b last:border-0 text-sm">
              <td className="py-2 px-3 font-medium">{p.razonSocial ?? '—'}</td>
              <td className="py-2 px-3">${p.totalCompras.toLocaleString('es-AR')}</td>
              <td className="py-2 px-3">{p.volumenTotal.toLocaleString('es-AR')}</td>
              <td className="py-2 px-3">{p.cantidadOrdenes}</td>
            </tr>
          ))}
          {data?.length === 0 && (
            <tr><td colSpan={4} className="py-4 px-3 text-sm text-gray-500 text-center">Sin datos</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
