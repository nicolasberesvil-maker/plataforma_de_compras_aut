import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productosApi } from '../api/productos.api';
import { CategoriaBadge } from '../components/CategoriaBadge';

const CATEGORIAS = ['AGROQUIMICO', 'FERTILIZANTE', 'SEMILLA', 'INOCULANTE', 'NUTRICION_ANIMAL', 'SANIDAD_ANIMAL', 'OTRO'];

export function ProductosListPage() {
  const [categoria, setCategoria] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['productos', { categoria, search, page }],
    queryFn: () => productosApi.listar({ categoria: categoria || undefined, search: search || undefined, page })
  });

  const desactivar = useMutation({
    mutationFn: (id) => productosApi.desactivar(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] })
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Productos</h2>
        <Link to="/admin/productos/nuevo" className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium">
          Nuevo producto
        </Link>
      </div>

      {desactivar.isError && (
        <p className="text-red-600 text-sm">
          {desactivar.error.response?.data?.error?.message || 'Error al desactivar el producto'}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          value={categoria}
          onChange={(e) => { setCategoria(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nombre"
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500 uppercase">
                <th className="py-2 px-3">Nombre</th>
                <th className="py-2 px-3">Categoría</th>
                <th className="py-2 px-3">Unidad</th>
                <th className="py-2 px-3">IVA</th>
                <th className="py-2 px-3">Estado</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((producto) => (
                <tr key={producto.id} className="border-b">
                  <td className="py-2 px-3 text-sm">{producto.nombre}</td>
                  <td className="py-2 px-3"><CategoriaBadge categoria={producto.categoria} /></td>
                  <td className="py-2 px-3 text-sm">{producto.unidadMedida}</td>
                  <td className="py-2 px-3 text-sm">{producto.alicuotaIva}%</td>
                  <td className="py-2 px-3 text-sm">{producto.activo ? 'Activo' : 'Inactivo'}</td>
                  <td className="py-2 px-3 text-sm text-right space-x-3 whitespace-nowrap">
                    <Link to={`/admin/productos/${producto.id}/editar`} className="text-aut-verde font-medium">
                      Editar
                    </Link>
                    {producto.activo && (
                      <button
                        onClick={() => desactivar.mutate(producto.id)}
                        disabled={desactivar.isPending}
                        className="text-aut-naranja font-medium disabled:opacity-50"
                      >
                        Desactivar
                      </button>
                    )}
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
            Página {data.pagination.page} de {data.pagination.totalPages} ({data.pagination.total} productos)
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
