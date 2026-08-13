import { useQuery } from '@tanstack/react-query';
import { entregasApi } from '../api/entregas.api';
import { EntregaProveedorCard } from '../components/EntregaProveedorCard';

export function EntregasProveedorPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['entregas', 'mias-proveedor'],
    queryFn: () => entregasApi.listarMiasProveedor()
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Mis entregas</h2>
        <p className="text-sm text-gray-500">
          Las entregas en campo las confirmás vos o el productor; los retiros en depósito los confirma AUT.
        </p>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !data?.entregas.length ? (
        <p className="text-gray-500 text-sm">Todavía no tenés entregas en curso.</p>
      ) : (
        <div className="space-y-3">
          {data.entregas.map((entrega) => <EntregaProveedorCard key={entrega.id} entrega={entrega} />)}
        </div>
      )}
    </div>
  );
}
