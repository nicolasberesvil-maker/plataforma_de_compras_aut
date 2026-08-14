import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { resumenApi } from '../api/resumen.api';
import { ResumenPedidosTable } from '../components/ResumenPedidosTable';

const ESTADOS = [
  ['', 'Todos los estados'],
  ['SUELTO_PENDIENTE', 'Pedido suelto'],
  ['AGRUPADA', 'Agrupado'],
  ['EN_LICITACION', 'En licitación'],
  ['ORDEN_PENDIENTE', 'Orden — pago pendiente'],
  ['ORDEN_PARCIAL', 'Orden — pago parcial'],
  ['ORDEN_PAGADO', 'Orden — pagado'],
  ['ORDEN_VENCIDO', 'Orden — vencido'],
  ['ORDEN_CANCELADO', 'Orden — cancelado']
];

export function ResumenPedidosAdminPage() {
  const [searchParams] = useSearchParams();
  const loteId = searchParams.get('loteId') || undefined;
  const [filtros, setFiltros] = useState({ search: '', estado: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['resumen', 'pedidos', filtros, loteId],
    queryFn: () => resumenApi.listarPedidos({
      search: filtros.search || undefined,
      estado: filtros.estado || undefined,
      loteId
    })
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Resumen de pedidos</h2>
        <p className="text-sm text-gray-500">
          Todos los pedidos de todos los productores, sueltos o agrupados, hayan llegado o no a convertirse en una orden.
        </p>
      </div>

      <div className="bg-white border rounded-lg p-3 flex flex-col sm:flex-row gap-2">
        <input
          value={filtros.search}
          onChange={(e) => setFiltros((f) => ({ ...f, search: e.target.value }))}
          placeholder="Buscar por razón social o CUIT"
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={filtros.estado}
          onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm sm:w-56"
        >
          {ESTADOS.map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <ResumenPedidosTable rows={data?.data ?? []} mostrarProductor />
      )}
    </div>
  );
}
