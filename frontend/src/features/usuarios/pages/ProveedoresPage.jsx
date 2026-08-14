import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { proveedoresApi } from '../api/proveedores.api';
import { NuevoProveedorForm } from '../components/NuevoProveedorForm';
import { Modal } from '../../../components/Modal';

const ESTADOS = [
  ['', 'Todos los estados'],
  ['PENDIENTE', 'Pendiente'],
  ['APROBADO', 'Aprobado'],
  ['RECHAZADO', 'Rechazado'],
  ['SUSPENDIDO', 'Suspendido']
];

export function ProveedoresPage() {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [resultadoAlta, setResultadoAlta] = useState(null);
  const [filtros, setFiltros] = useState({ search: '', estadoAprobacion: '' });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['proveedores', filtros],
    queryFn: () => proveedoresApi.listar({
      search: filtros.search || undefined,
      estadoAprobacion: filtros.estadoAprobacion || undefined
    })
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

  function cerrarModal() {
    setModalAbierto(false);
    setResultadoAlta(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Proveedores</h2>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-1.5 bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} />
          Agregar proveedor
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
          value={filtros.estadoAprobacion}
          onChange={(e) => setFiltros((f) => ({ ...f, estadoAprobacion: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm sm:w-48"
        >
          {ESTADOS.map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : !data?.data.length ? (
        <p className="text-gray-500 text-sm">No hay proveedores que coincidan con la búsqueda.</p>
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
              {data.data.map((proveedor) => (
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
      )}

      {modalAbierto && (
        <Modal titulo="Nuevo proveedor" onCerrar={cerrarModal}>
          <NuevoProveedorForm
            isLoading={crear.isPending}
            resultado={resultadoAlta}
            onSubmit={(datos, reset) => crear.mutate(datos, { onSuccess: () => reset() })}
          />
        </Modal>
      )}
    </div>
  );
}
