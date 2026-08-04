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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Mis pedidos</h2>
          <p className="text-sm text-gray-500">
            Lo que fuiste pidiendo, todavía sin convertirse en una compra confirmada. AUT los junta con los de otros productores para negociar mejor precio.
          </p>
        </div>
        <Link to="/productor/pedir" className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0">
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
