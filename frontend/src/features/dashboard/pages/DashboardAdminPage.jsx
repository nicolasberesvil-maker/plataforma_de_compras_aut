import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard.api';
import { KpiCard } from '../components/KpiCard';
import { FiltrosFechas } from '../components/FiltrosFechas';
import { VolumenPorInsumoChart } from '../components/VolumenPorInsumoChart';
import { FormasPagoChart } from '../components/FormasPagoChart';
import { RankingProveedoresTable } from '../components/RankingProveedoresTable';
import { TopProductoresTable } from '../components/TopProductoresTable';
import { BalanceIvaCard } from '../components/BalanceIvaCard';

export function DashboardAdminPage() {
  const [filtros, setFiltros] = useState({ desde: '', hasta: '' });
  const [exportando, setExportando] = useState(false);

  const params = {};
  if (filtros.desde) params.desde = filtros.desde;
  if (filtros.hasta) params.hasta = filtros.hasta;

  const { data: kpis, isLoading: kpisLoading } = useQuery({ queryKey: ['dashboard', 'kpis', params], queryFn: () => dashboardApi.kpis(params) });
  const { data: volumenData, isLoading: volumenLoading } = useQuery({ queryKey: ['dashboard', 'volumen', params], queryFn: () => dashboardApi.volumenPorInsumo(params) });
  const { data: rankingData, isLoading: rankingLoading } = useQuery({ queryKey: ['dashboard', 'ranking', params], queryFn: () => dashboardApi.rankingProveedores(params) });
  const { data: topProdData, isLoading: topProdLoading } = useQuery({ queryKey: ['dashboard', 'top-productores'], queryFn: () => dashboardApi.topProductores() });
  const { data: balanceIva, isLoading: balanceIvaLoading } = useQuery({ queryKey: ['dashboard', 'balance-iva', params], queryFn: () => dashboardApi.balanceIva(params) });
  const { data: formasPagoData, isLoading: formasPagoLoading } = useQuery({ queryKey: ['dashboard', 'formas-pago'], queryFn: () => dashboardApi.formasPago() });

  async function exportar() {
    setExportando(true);
    try {
      const blob = await dashboardApi.exportarExcel(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-aut-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold">Dashboard</h2>
        <button
          onClick={exportar} disabled={exportando}
          className="text-sm bg-aut-verde text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {exportando ? 'Generando...' : 'Exportar a Excel'}
        </button>
      </div>

      <FiltrosFechas filtros={filtros} onChange={setFiltros} />

      {kpisLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard titulo="Ahorro acumulado" valor={`$${(kpis?.ahorroAcumulado ?? 0).toLocaleString('es-AR')}`} color="#1d9e75" />
          <KpiCard titulo="Volumen total" valor={(kpis?.volumenAcumulado ?? 0).toLocaleString('es-AR')} color="#3B82F6" />
          <KpiCard
            titulo="Campañas activas"
            valor={kpis?.campanas?.activas ?? 0}
            subtexto={`${kpis?.campanas?.total ?? 0} en total`}
            color="#8B5CF6"
          />
          <KpiCard
            titulo="Tasa de adopción"
            valor={`${(kpis?.tasaAdopcion?.porcentaje ?? 0).toFixed(1)}%`}
            subtexto={`${kpis?.tasaAdopcion?.activos ?? 0} de ${kpis?.tasaAdopcion?.total ?? 0} productores`}
            color="#F59E0B"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Volumen por insumo</h3>
          {volumenLoading ? <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p> : <VolumenPorInsumoChart data={volumenData?.volumen} />}
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Formas de pago más adoptadas</h3>
          {formasPagoLoading ? <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p> : <FormasPagoChart data={formasPagoData?.formasPago} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Ranking de proveedores</h3>
          {rankingLoading ? <p className="text-sm text-gray-500">Cargando...</p> : <RankingProveedoresTable data={rankingData?.ranking} />}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Top productores</h3>
          {topProdLoading ? <p className="text-sm text-gray-500">Cargando...</p> : <TopProductoresTable data={topProdData?.topProductores} />}
        </div>
      </div>

      {!balanceIvaLoading && <BalanceIvaCard data={balanceIva} />}
    </div>
  );
}
