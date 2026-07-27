import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usuariosApi } from '../api/usuarios.api';
import { UsuarioRow } from '../components/UsuarioRow';

const ROLES = ['PRODUCTOR', 'PROVEEDOR', 'ADMIN', 'OPERADOR', 'CONTADOR', 'OPERADOR_DEPOSITO'];

export function UsuariosListPage() {
  const [rol, setRol] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['usuarios', { rol, search, page }],
    queryFn: () => usuariosApi.listar({ rol: rol || undefined, search: search || undefined, page })
  });

  const cambiarEstado = useMutation({
    mutationFn: ({ id, activo }) => (activo ? usuariosApi.activar(id) : usuariosApi.desactivar(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] })
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Usuarios</h2>

      <div className="flex flex-wrap gap-3">
        <select
          value={rol}
          onChange={(e) => { setRol(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Todos los roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nombre o email"
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
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Rol</th>
                <th className="py-2 px-3">Estado</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((usuario) => (
                <UsuarioRow
                  key={usuario.id}
                  usuario={usuario}
                  isLoading={cambiarEstado.isPending}
                  onActivar={(id) => cambiarEstado.mutate({ id, activo: true })}
                  onDesactivar={(id) => cambiarEstado.mutate({ id, activo: false })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Página {data.pagination.page} de {data.pagination.totalPages} ({data.pagination.total} usuarios)
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
