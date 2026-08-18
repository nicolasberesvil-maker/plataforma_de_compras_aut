import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campanasApi } from '../api/campanas.api';
import { TipoBadge } from '../components/TipoBadge';
import { EstadoBadge } from '../components/EstadoBadge';
import { CotizacionEstadoBadge } from '../components/CotizacionEstadoBadge';

const TIPOS = ['COLECTIVA', 'DIRECTA', 'CONTINUA'];

// Siempre se usa dentro de una de las pestañas de PedidosAdminPage /
// OrdenesCompraAdminPage: vista fija el estado, así que acá solo queda
// filtrar por tipo.
export function CampanasListPage({ vista }) {
  const [tipo, setTipo] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['campanas', { tipo, vista, page }],
    queryFn: () => campanasApi.listar({ tipo: tipo || undefined, vista, page })
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
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
                <th className="py-2 px-3">Presupuesto</th>
                <th className="py-2 px-3">Orden de compra</th>
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
                    {campana.adjudicacion?.cotizacionGanadora?.createdAt
                      ? new Date(campana.adjudicacion.cotizacionGanadora.createdAt).toLocaleDateString('es-AR')
                      : '—'}
                  </td>
                  <td className="py-2 px-3 text-sm">
                    {campana.adjudicacion?.adjudicadaAt
                      ? new Date(campana.adjudicacion.adjudicadaAt).toLocaleDateString('es-AR')
                      : '—'}
                  </td>
                  <td className="py-2 px-3 text-sm">
                    {campana.fechaCierre ? new Date(campana.fechaCierre).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="py-2 px-3 text-sm text-right whitespace-nowrap">
                    <AccionCampana campana={campana} />
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

// Una sola acción visible por fila, la que corresponde al siguiente paso del
// pedido — así el admin no tiene que adivinar dónde está el botón.
function AccionCampana({ campana }) {
  const queryClient = useQueryClient();
  const enviarOrden = useMutation({
    mutationFn: () => campanasApi.enviarOrdenProveedor(campana.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campanas'] })
  });

  if (campana.estado === 'ABIERTA') {
    return (
      <Link to={`/admin/campanas/${campana.id}`} className="bg-aut-verde text-white px-3 py-1.5 rounded-lg font-medium">
        Enviar a proveedor →
      </Link>
    );
  }

  if (campana.estado === 'EN_LICITACION') {
    return (
      <Link
        to={campana.tipo === 'COLECTIVA' ? `/admin/campanas/${campana.id}/comparador` : `/admin/campanas/${campana.id}`}
        className="bg-sky-600 text-white px-3 py-1.5 rounded-lg font-medium"
      >
        Convertir a orden de compra →
      </Link>
    );
  }

  if (campana.estado === 'ADJUDICADA') {
    return (
      <button
        onClick={() => enviarOrden.mutate()}
        disabled={enviarOrden.isPending}
        className="bg-aut-verde text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
      >
        {enviarOrden.isPending ? 'Enviando...' : enviarOrden.isSuccess ? 'Enviada al proveedor ✓' : 'Enviar orden a proveedor →'}
      </button>
    );
  }

  return (
    <Link to={`/admin/campanas/${campana.id}`} className="text-aut-verde font-medium">
      Ver
    </Link>
  );
}
