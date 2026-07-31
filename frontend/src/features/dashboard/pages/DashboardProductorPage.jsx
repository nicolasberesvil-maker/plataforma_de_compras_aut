import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard.api';
import { KpiCard } from '../components/KpiCard';
import { EstadoEntregaBadge } from '../../entregas/components/EstadoEntregaBadge';

export function DashboardProductorPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'mi'], queryFn: () => dashboardApi.mi() });

  const proximaEntrega = data?.proximaEntrega;
  const producto = proximaEntrega?.ordenCompra?.adjudicacion?.campana?.producto;

  return (
    <div className="max-w-lg mx-auto space-y-4 p-4">
      <h2 className="text-lg font-bold">Mi resumen</h2>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard titulo="Mi ahorro" valor={`$${(data?.ahorroAcumulado ?? 0).toLocaleString('es-AR')}`} color="#1d9e75" />
            <KpiCard titulo="Mis compras" valor={`$${(data?.totalGastado ?? 0).toLocaleString('es-AR')}`} color="#3B82F6" />
          </div>

          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Mi próxima entrega</h3>
            {!proximaEntrega ? (
              <p className="text-sm text-gray-500">No tenés entregas pendientes.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <Link to={`/productor/entregas/${proximaEntrega.id}`} className="font-medium text-aut-verde">
                      {producto?.nombre}
                    </Link>
                    <p className="text-sm text-gray-600">
                      {Number(proximaEntrega.ordenCompra?.volumenFinal)} {producto?.unidadMedida}
                    </p>
                  </div>
                  <EstadoEntregaBadge estado={proximaEntrega.estado} />
                </div>
                {proximaEntrega.deposito && (
                  <p className="text-xs text-gray-500">📍 {proximaEntrega.deposito.nombre}</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
