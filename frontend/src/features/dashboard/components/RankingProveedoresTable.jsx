export function RankingProveedoresTable({ data }) {
  return (
    <div className="bg-white rounded-lg border overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-xs text-gray-500 uppercase">
            <th className="py-2 px-3">Proveedor</th>
            <th className="py-2 px-3">Campañas ganadas</th>
            <th className="py-2 px-3">Volumen adjudicado</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((p) => (
            <tr key={p.proveedorId} className="border-b last:border-0 text-sm">
              <td className="py-2 px-3 font-medium">{p.razonSocial}</td>
              <td className="py-2 px-3">{p.campanasGanadas}</td>
              <td className="py-2 px-3">{p.volumenAdjudicado.toLocaleString('es-AR')}</td>
            </tr>
          ))}
          {data?.length === 0 && (
            <tr><td colSpan={3} className="py-4 px-3 text-sm text-gray-500 text-center">Sin datos</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
