import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { depositosApi } from '../api/depositos.api';

export function DepositosListPage() {
  const [activo, setActivo] = useState('true');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['depositos', { activo }],
    queryFn: () => depositosApi.listar({ activo })
  });

  const desactivar = useMutation({
    mutationFn: (id) => depositosApi.desactivar(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['depositos'] })
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Depósitos</h2>
        <Link to="/admin/depositos/nuevo" className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium">
          Nuevo depósito
        </Link>
      </div>

      {desactivar.isError && (
        <p className="text-red-600 text-sm">
          {desactivar.error.response?.data?.error?.message || 'Error al desactivar el depósito'}
        </p>
      )}

      <select
        value={activo}
        onChange={(e) => setActivo(e.target.value)}
        className="border rounded-lg px-3 py-2 text-sm"
      >
        <option value="true">Activos</option>
        <option value="false">Inactivos</option>
      </select>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500 uppercase">
                <th className="py-2 px-3">Nombre</th>
                <th className="py-2 px-3">Localidad</th>
                <th className="py-2 px-3">Dirección</th>
                <th className="py-2 px-3">Responsable</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((deposito) => (
                <tr key={deposito.id} className="border-b">
                  <td className="py-2 px-3 text-sm">
                    <Link to={`/admin/depositos/${deposito.id}`} className="text-aut-verde font-medium">
                      {deposito.nombre}
                    </Link>
                  </td>
                  <td className="py-2 px-3 text-sm">{deposito.localidad}</td>
                  <td className="py-2 px-3 text-sm">{deposito.direccion}</td>
                  <td className="py-2 px-3 text-sm">{deposito.responsable || '—'}</td>
                  <td className="py-2 px-3 text-sm text-right space-x-3 whitespace-nowrap">
                    <Link to={`/admin/depositos/${deposito.id}/editar`} className="text-aut-verde font-medium">
                      Editar
                    </Link>
                    {deposito.activo && (
                      <button
                        onClick={() => desactivar.mutate(deposito.id)}
                        disabled={desactivar.isPending}
                        className="text-aut-naranja font-medium disabled:opacity-50"
                      >
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 px-3 text-sm text-gray-500 text-center">Sin depósitos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
