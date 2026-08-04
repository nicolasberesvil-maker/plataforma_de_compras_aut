import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { proveedoresApi } from '../api/proveedores.api';
import { NuevoProveedorForm } from '../components/NuevoProveedorForm';

const TABS = [
  { id: 'listado', label: 'Listado' },
  { id: 'nuevo', label: 'Cargar nuevo' }
];

export function ProveedoresPage() {
  const [tab, setTab] = useState('listado');
  const [resultadoAlta, setResultadoAlta] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => proveedoresApi.listar({})
  });

  const crear = useMutation({
    mutationFn: (datos) => proveedoresApi.crear(datos),
    onSuccess: (data) => {
      setResultadoAlta(data);
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      setTab('listado');
    }
  });

  const suspender = useMutation({
    mutationFn: (id) => proveedoresApi.suspender(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proveedores'] })
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Proveedores</h2>

      <div className="flex gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id ? 'border-aut-verde text-aut-verde' : 'border-transparent text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'nuevo' && (
        <NuevoProveedorForm
          isLoading={crear.isPending}
          resultado={resultadoAlta}
          onSubmit={(datos, reset) => crear.mutate(datos, { onSuccess: () => reset() })}
        />
      )}

      {tab === 'listado' && (
        isLoading ? (
          <p className="text-gray-500 text-sm">Cargando...</p>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500 uppercase">
                  <th className="py-2 px-3">Razón social</th>
                  <th className="py-2 px-3">CUIT</th>
                  <th className="py-2 px-3">Email</th>
                  <th className="py-2 px-3">Estado</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((proveedor) => (
                  <tr key={proveedor.id} className="border-b">
                    <td className="py-2 px-3 text-sm">
                      <Link to={`/admin/proveedores/${proveedor.id}`} className="text-aut-verde font-medium">
                        {proveedor.razonSocial}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-sm">{proveedor.cuit}</td>
                    <td className="py-2 px-3 text-sm text-gray-600">{proveedor.usuario?.email}</td>
                    <td className="py-2 px-3 text-sm">{proveedor.estadoAprobacion}</td>
                    <td className="py-2 px-3 text-sm text-right">
                      {proveedor.estadoAprobacion !== 'SUSPENDIDO' && (
                        <button
                          onClick={() => suspender.mutate(proveedor.id)}
                          disabled={suspender.isPending}
                          className="text-aut-naranja font-medium disabled:opacity-50"
                        >
                          Suspender
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
