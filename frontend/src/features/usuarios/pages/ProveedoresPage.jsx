import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { proveedoresApi } from '../api/proveedores.api';
import { NuevoProveedorForm } from '../components/NuevoProveedorForm';

export function ProveedoresPage() {
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
    }
  });

  const suspender = useMutation({
    mutationFn: (id) => proveedoresApi.suspender(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proveedores'] })
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Proveedores</h2>

      <NuevoProveedorForm
        isLoading={crear.isPending}
        resultado={resultadoAlta}
        onSubmit={(datos, reset) => crear.mutate(datos, { onSuccess: () => reset() })}
      />

      {isLoading ? (
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
                  <td className="py-2 px-3 text-sm">{proveedor.razonSocial}</td>
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
      )}
    </div>
  );
}
