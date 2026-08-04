import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productoresApi } from '../api/productores.api';
import { NuevoProductorForm } from '../components/NuevoProductorForm';

export function ProductoresPage() {
  const [resultadoAlta, setResultadoAlta] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['productores'],
    queryFn: () => productoresApi.listar({})
  });

  const crear = useMutation({
    mutationFn: (datos) => productoresApi.crear(datos),
    onSuccess: (data) => {
      setResultadoAlta(data);
      queryClient.invalidateQueries({ queryKey: ['productores'] });
    }
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Productores</h2>

      <NuevoProductorForm
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
                <th className="py-2 px-3">Usuario</th>
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((productor) => (
                <tr key={productor.id} className="border-b">
                  <td className="py-2 px-3 text-sm">{productor.razonSocial}</td>
                  <td className="py-2 px-3 text-sm">{productor.cuit}</td>
                  <td className="py-2 px-3 text-sm text-gray-600">{productor.usuario?.username}</td>
                  <td className="py-2 px-3 text-sm text-gray-600">{productor.usuario?.email}</td>
                  <td className="py-2 px-3 text-sm">{productor.usuario?.activo ? 'Activo' : 'Inactivo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
