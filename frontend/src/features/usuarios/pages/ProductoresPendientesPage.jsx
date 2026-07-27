import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productoresApi } from '../api/productores.api';
import { AprobarProductorModal } from '../components/AprobarProductorModal';

export function ProductoresPendientesPage() {
  const [seleccionado, setSeleccionado] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['productores', 'pendientes'],
    queryFn: () => productoresApi.listarPendientes()
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['productores', 'pendientes'] });

  const aprobar = useMutation({
    mutationFn: (id) => productoresApi.aprobar(id),
    onSuccess: () => { invalidar(); setSeleccionado(null); }
  });

  const rechazar = useMutation({
    mutationFn: ({ id, motivo }) => productoresApi.rechazar(id, motivo),
    onSuccess: () => { invalidar(); setSeleccionado(null); }
  });

  const pendientes = data?.data ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Productores pendientes de aprobación</h2>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : pendientes.length === 0 ? (
        <p className="text-gray-500 text-sm">No hay productores pendientes.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pendientes.map((productor) => (
            <button
              key={productor.id}
              onClick={() => setSeleccionado(productor)}
              className="text-left bg-white border rounded-lg p-4 hover:border-aut-verde"
            >
              <p className="font-medium">{productor.razonSocial}</p>
              <p className="text-sm text-gray-600">{productor.cuit}</p>
              <p className="text-sm text-gray-600">{productor.usuario?.email}</p>
            </button>
          ))}
        </div>
      )}

      <AprobarProductorModal
        productor={seleccionado}
        isLoading={aprobar.isPending || rechazar.isPending}
        onClose={() => setSeleccionado(null)}
        onAprobar={(id) => aprobar.mutate(id)}
        onRechazar={(id, motivo) => rechazar.mutate({ id, motivo })}
      />
    </div>
  );
}
