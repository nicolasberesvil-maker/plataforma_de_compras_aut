import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entregasApi } from '../api/entregas.api';
import { FiltrosEntregas } from '../components/FiltrosEntregas';
import { EntregaRow } from '../components/EntregaRow';

export function EntregasAdminPage() {
  const [filtros, setFiltros] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['entregas', filtros],
    queryFn: () => entregasApi.listar(filtros)
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold">Entregas</h2>
        <FiltrosEntregas filtros={filtros} onChange={setFiltros} />
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500 uppercase">
                <th className="py-2 px-3">Producto</th>
                <th className="py-2 px-3">Productor</th>
                <th className="py-2 px-3">Destino</th>
                <th className="py-2 px-3">Estado</th>
                <th className="py-2 px-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((entrega) => <EntregaRow key={entrega.id} entrega={entrega} />)}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 px-3 text-sm text-gray-500 text-center">Sin entregas</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
