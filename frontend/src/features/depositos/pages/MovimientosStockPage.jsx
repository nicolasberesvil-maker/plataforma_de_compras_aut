import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { stockApi } from '../api/stock.api';
import { depositosApi } from '../api/depositos.api';

const TIPO_LABEL = {
  INGRESO_PROVEEDOR: 'Ingreso',
  EGRESO_PRODUCTOR: 'Egreso a productor',
  AJUSTE_INVENTARIO_POSITIVO: 'Ajuste (+)',
  AJUSTE_INVENTARIO_NEGATIVO: 'Ajuste (-)',
  TRANSFERENCIA_SALIDA: 'Transferencia (salida)',
  TRANSFERENCIA_ENTRADA: 'Transferencia (entrada)',
  DEVOLUCION_PROVEEDOR: 'Devolución a proveedor'
};

export function MovimientosStockPage() {
  const [searchParams] = useSearchParams();
  const [depositoId, setDepositoId] = useState(searchParams.get('depositoId') || '');
  const [page, setPage] = useState(1);

  const { data: depositosData } = useQuery({
    queryKey: ['depositos', { activo: true }],
    queryFn: () => depositosApi.listar({ activo: true })
  });

  const { data, isLoading } = useQuery({
    queryKey: ['stock-movimientos', { depositoId, page }],
    queryFn: () => stockApi.listarMovimientos({ depositoId: depositoId || undefined, page })
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Historial de movimientos de stock</h2>

      <select
        value={depositoId}
        onChange={(e) => { setDepositoId(e.target.value); setPage(1); }}
        className="border rounded-lg px-3 py-2 text-sm"
      >
        <option value="">Todos los depósitos</option>
        {depositosData?.data.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
      </select>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500 uppercase">
                <th className="py-2 px-3">Fecha</th>
                <th className="py-2 px-3">Depósito</th>
                <th className="py-2 px-3">Producto</th>
                <th className="py-2 px-3">Tipo</th>
                <th className="py-2 px-3 text-right">Cantidad</th>
                <th className="py-2 px-3">Orden de compra</th>
                <th className="py-2 px-3">Ejecutado por</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="py-2 px-3 text-sm">{new Date(m.fecha).toLocaleString('es-AR')}</td>
                  <td className="py-2 px-3 text-sm">{m.deposito.nombre}</td>
                  <td className="py-2 px-3 text-sm">{m.producto.nombre}</td>
                  <td className="py-2 px-3 text-sm">{TIPO_LABEL[m.tipo] || m.tipo}</td>
                  <td className={`py-2 px-3 text-sm text-right font-medium ${m.signo < 0 ? 'text-red-600' : 'text-aut-verde'}`}>
                    {m.signo > 0 ? '+' : '-'}{Number(m.cantidad).toLocaleString('es-AR')}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-600">
                    {m.entrega?.ordenCompraId ? `Orden #${m.entrega.ordenCompraId}` : '—'}
                  </td>
                  <td className="py-2 px-3 text-sm">{m.ejecutadoPor.nombre} {m.ejecutadoPor.apellido}</td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 px-3 text-sm text-gray-500 text-center">Sin movimientos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Página {data.pagination.page} de {data.pagination.totalPages} ({data.pagination.total} movimientos)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pagination.totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
