import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { intencionesApi } from '../api/intenciones.api';
import { PedidoCard } from '../components/PedidoCard';

export function MisPedidosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['intenciones', 'mias'],
    queryFn: () => intencionesApi.listarMias()
  });

  return (
    <div className="max-w-lg mx-auto space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Mis pedidos</h2>
        <Link to="/productor/pedir" className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium">
          Pedir un producto
        </Link>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !data?.intenciones.length ? (
        <p className="text-gray-500 text-sm">Todavía no cargaste ningún pedido.</p>
      ) : (
        <div className="space-y-3">
          {data.intenciones.map((pedido) => <PedidoCard key={pedido.id} pedido={pedido} />)}
        </div>
      )}
    </div>
  );
}
