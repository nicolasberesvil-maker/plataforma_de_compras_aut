import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { resumenApi } from '../../resumen/api/resumen.api';
import { ResumenPedidosTable } from '../../resumen/components/ResumenPedidosTable';

export function MisPedidosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['resumen', 'pedidos', 'mias'],
    queryFn: () => resumenApi.listarPedidos({})
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Mis pedidos</h2>
          <p className="text-sm text-gray-500">
            Todo lo que fuiste pidiendo, esté suelto, agrupado en un pedido de cotización o ya convertido en orden.
          </p>
        </div>
        <Link to="/productor/pedir" className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0">
          Pedir un producto
        </Link>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <ResumenPedidosTable rows={data?.data ?? []} mostrarProductor={false} />
      )}
    </div>
  );
}
