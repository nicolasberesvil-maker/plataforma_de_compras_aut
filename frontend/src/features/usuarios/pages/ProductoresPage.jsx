import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { productoresApi } from '../api/productores.api';
import { NuevoProductorForm } from '../components/NuevoProductorForm';
import { Modal } from '../../../components/Modal';

const ESTADOS = [
  ['', 'Todos los estados'],
  ['ACTIVO', 'Activo'],
  ['INACTIVO', 'Inactivo']
];

export function ProductoresPage() {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [resultadoAlta, setResultadoAlta] = useState(null);
  const [filtros, setFiltros] = useState({ search: '', estado: '' });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['productores', filtros],
    queryFn: () => productoresApi.listar({
      search: filtros.search || undefined,
      estado: filtros.estado || undefined
    })
  });

  const crear = useMutation({
    mutationFn: (datos) => productoresApi.crear(datos),
    onSuccess: (data) => {
      setResultadoAlta(data);
      queryClient.invalidateQueries({ queryKey: ['productores'] });
    }
  });

  function cerrarModal() {
    setModalAbierto(false);
    setResultadoAlta(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Productores</h2>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-1.5 bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} />
          Agregar productor
        </button>
      </div>

      <div className="bg-white border rounded-lg p-3 flex flex-col sm:flex-row gap-2">
        <input
          value={filtros.search}
          onChange={(e) => setFiltros((f) => ({ ...f, search: e.target.value }))}
          placeholder="Buscar por nombre, razón social o CUIT"
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={filtros.estado}
          onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm sm:w-48"
        >
          {ESTADOS.map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !data?.data.length ? (
        <p className="text-gray-500 text-sm">No hay productores que coincidan con la búsqueda.</p>
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
              {data.data.map((productor) => (
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

      {modalAbierto && (
        <Modal titulo="Nuevo productor" onCerrar={cerrarModal}>
          <NuevoProductorForm
            isLoading={crear.isPending}
            resultado={resultadoAlta}
            onSubmit={(datos, reset) => crear.mutate(datos, { onSuccess: () => reset() })}
          />
        </Modal>
      )}
    </div>
  );
}
