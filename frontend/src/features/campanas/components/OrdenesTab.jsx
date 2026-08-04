import { useQuery } from '@tanstack/react-query';
import { ordenesApi } from '../../ordenes/api/ordenes.api';

export function OrdenesTab({ campanaId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['ordenes', { campanaId }],
    queryFn: () => ordenesApi.listar({ campanaId, limit: 100 })
  });

  const ordenes = data?.data ?? [];

  if (isLoading) return <p className="text-gray-500 text-sm">Cargando...</p>;
  if (ordenes.length === 0) return <p className="text-sm text-gray-500">Todavía no hay órdenes generadas para esta compra.</p>;

  return (
    <div className="bg-white rounded-lg border overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-xs text-gray-500 uppercase">
            <th className="py-2 px-3">Productor</th>
            <th className="py-2 px-3 text-right">Volumen</th>
            <th className="py-2 px-3 text-right">Total</th>
            <th className="py-2 px-3">Estado de pago</th>
            <th className="py-2 px-3">Entrega</th>
          </tr>
        </thead>
        <tbody>
          {ordenes.map((o) => (
            <tr key={o.id} className="border-b">
              <td className="py-2 px-3 text-sm">{o.productor?.razonSocial}</td>
              <td className="py-2 px-3 text-sm text-right">{Number(o.volumenFinal).toLocaleString('es-AR')}</td>
              <td className="py-2 px-3 text-sm text-right font-medium">{Number(o.total).toLocaleString('es-AR')}</td>
              <td className="py-2 px-3 text-sm">{o.estadoPago}</td>
              <td className="py-2 px-3 text-sm">{o.entrega?.estado ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
