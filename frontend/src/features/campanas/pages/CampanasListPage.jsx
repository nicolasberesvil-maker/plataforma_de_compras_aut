import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { campanasApi } from '../api/campanas.api';
import { TipoBadge } from '../components/TipoBadge';
import { EstadoBadge } from '../components/EstadoBadge';
import { CotizacionEstadoBadge } from '../components/CotizacionEstadoBadge';

const TIPOS = ['COLECTIVA', 'DIRECTA', 'CONTINUA'];
const ESTADOS = ['BORRADOR', 'ABIERTA', 'EN_LICITACION', 'ADJUDICADA', 'CERRADA', 'CANCELADA'];

// vista: si viene ('agrupadas' | 'concretadas'), esta lista es una de las
// pestañas de PedidosAdminPage — el filtro de estado queda fijo y se oculta,
// el backend ya filtra por vista (ver campanas.service.js listar()).
export function CampanasListPage({ vista }) {
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['campanas', { tipo, estado, vista, page }],
    queryFn: () => campanasApi.listar({ tipo: tipo || undefined, estado: vista ? undefined : (estado || undefined), vista, page })
  });

  return (
    <div className="space-y-4">
      {!vista && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Compras</h2>
          <Link to="/admin/campanas/nueva" className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium">
            Nueva compra
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {!vista && (
          <select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500 uppercase">
                <th className="py-2 px-3">Nombre</th>
                <th className="py-2 px-3">Producto</th>
                <th className="py-2 px-3">Lote</th>
                <th className="py-2 px-3">Tipo</th>
                <th className="py-2 px-3">Estado</th>
                <th className="py-2 px-3">Cierre</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((campana) => (
                <tr key={campana.id} className="border-b">
                  <td className="py-2 px-3 text-sm">{campana.nombre}</td>
                  <td className="py-2 px-3 text-sm">{campana.producto?.nombre}</td>
                  <td className="py-2 px-3 text-sm text-gray-600">{campana.lote?.nombre ?? 'Individual'}</td>
                  <td className="py-2 px-3"><TipoBadge tipo={campana.tipo} /></td>
                  <td className="py-2 px-3">
                    <div className="flex flex-col gap-1 items-start">
                      <EstadoBadge estado={campana.estado} />
                      <CotizacionEstadoBadge campana={campana} />
                    </div>
                  </td>
                  <td className="py-2 px-3 text-sm">
                    {campana.fechaCierre ? new Date(campana.fechaCierre).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="py-2 px-3 text-sm text-right whitespace-nowrap">
                    <Link to={`/admin/campanas/${campana.id}`} className="text-aut-verde font-medium">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Página {data.pagination.page} de {data.pagination.totalPages} ({data.pagination.total} compras)
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
