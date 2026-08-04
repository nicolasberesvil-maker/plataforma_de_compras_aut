import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { intencionesApi } from '../api/intenciones.api';
import { AgruparPedidosModal } from '../components/AgruparPedidosModal';

const TABS = [
  { id: 'bandeja', label: 'Bandeja' },
  { id: 'tablero', label: 'Tablero por producto' }
];

export function BandejaPedidosPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('bandeja');
  const [seleccionados, setSeleccionados] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['intenciones', 'bandeja'],
    queryFn: () => intencionesApi.listar({ estado: 'PENDIENTE', soloSueltas: true, limit: 100 })
  });

  const { data: tableroData, isLoading: cargandoTablero } = useQuery({
    queryKey: ['intenciones', 'tablero'],
    queryFn: () => intencionesApi.tablero(),
    enabled: tab === 'tablero'
  });

  const descartar = useMutation({
    mutationFn: ({ id, motivo }) => intencionesApi.descartar(id, motivo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['intenciones'] })
  });

  const pedidos = data?.data ?? [];
  const seleccionadosData = pedidos.filter((p) => seleccionados.includes(p.id));
  const productoSeleccionado = seleccionadosData[0]?.productoId;
  const seleccionValida = seleccionadosData.length > 0 && seleccionadosData.every((p) => p.productoId === productoSeleccionado);

  function toggle(id, productoId) {
    setSeleccionados((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      // Solo se puede seleccionar de a un producto por vez (se agrupan juntos).
      const actuales = pedidos.filter((p) => prev.includes(p.id));
      if (actuales.length > 0 && actuales[0].productoId !== productoId) return [id];
      return [...prev, id];
    });
  }

  function handleDescartar(id) {
    const motivo = window.prompt('Motivo del descarte (mínimo 5 caracteres):');
    if (motivo && motivo.trim().length >= 5) descartar.mutate({ id, motivo: motivo.trim() });
  }

  function armarCotizacionDesdeTablero(productoId) {
    const pendientesDelProducto = pedidos.filter((p) => p.productoId === productoId);
    if (pendientesDelProducto.length === 0) {
      window.alert('No hay pedidos sueltos pendientes de este producto para agrupar (puede que el volumen ya esté cargado en una campaña propia).');
      return;
    }
    setSeleccionados(pendientesDelProducto.map((p) => p.id));
    setMostrarModal(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Pedidos sueltos</h2>
        {tab === 'bandeja' && (
          <button
            onClick={() => setMostrarModal(true)}
            disabled={!seleccionValida}
            className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Agrupar seleccionados ({seleccionados.length})
          </button>
        )}
      </div>

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

      {tab === 'bandeja' && (
        isLoading ? (
          <p className="text-gray-500 text-sm">Cargando...</p>
        ) : !pedidos.length ? (
          <p className="text-gray-500 text-sm">No hay pedidos sueltos pendientes.</p>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500 uppercase">
                  <th className="py-2 px-3"></th>
                  <th className="py-2 px-3">Producto</th>
                  <th className="py-2 px-3">Productor</th>
                  <th className="py-2 px-3">Volumen</th>
                  <th className="py-2 px-3">Fecha deseada</th>
                  <th className="py-2 px-3">Modalidad</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={seleccionados.includes(p.id)}
                        onChange={() => toggle(p.id, p.productoId)}
                      />
                    </td>
                    <td className="py-2 px-3 text-sm">{p.producto?.nombre}</td>
                    <td className="py-2 px-3 text-sm">{p.productor?.razonSocial}</td>
                    <td className="py-2 px-3 text-sm">{Number(p.volumen)} {p.producto?.unidadMedida?.toLowerCase()}</td>
                    <td className="py-2 px-3 text-sm">
                      {p.fechaDeseada ? new Date(p.fechaDeseada).toLocaleDateString('es-AR') : '—'}
                    </td>
                    <td className="py-2 px-3 text-sm">{p.modalidadEntregaPreferida}</td>
                    <td className="py-2 px-3 text-sm text-right whitespace-nowrap">
                      <button onClick={() => handleDescartar(p.id)} className="text-aut-naranja font-medium">
                        Descartar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'tablero' && (
        cargandoTablero ? (
          <p className="text-gray-500 text-sm">Cargando...</p>
        ) : !tableroData?.data.length ? (
          <p className="text-gray-500 text-sm">No hay demanda pendiente ni campañas propias sin cerrar.</p>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500 uppercase">
                  <th className="py-2 px-3">Producto</th>
                  <th className="py-2 px-3 text-right">Sueltos pendientes</th>
                  <th className="py-2 px-3 text-right">En campañas propias</th>
                  <th className="py-2 px-3 text-right">Total</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {tableroData.data.map((row) => (
                  <tr key={row.productoId} className="border-b">
                    <td className="py-2 px-3 text-sm">{row.producto}</td>
                    <td className="py-2 px-3 text-sm text-right">
                      {row.totalSueltoPendiente.toLocaleString('es-AR')} {row.unidadMedida?.toLowerCase()}
                      <span className="text-gray-400"> ({row.cantidadPedidosSueltos})</span>
                    </td>
                    <td className="py-2 px-3 text-sm text-right">
                      {row.totalEnCampanasPropias.toLocaleString('es-AR')} {row.unidadMedida?.toLowerCase()}
                    </td>
                    <td className="py-2 px-3 text-sm text-right font-semibold">
                      {row.totalGeneral.toLocaleString('es-AR')} {row.unidadMedida?.toLowerCase()}
                    </td>
                    <td className="py-2 px-3 text-sm text-right whitespace-nowrap">
                      <button
                        onClick={() => armarCotizacionDesdeTablero(row.productoId)}
                        disabled={row.cantidadPedidosSueltos === 0}
                        className="text-aut-verde font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Armar cotización
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {mostrarModal && seleccionValida && (
        <AgruparPedidosModal
          pedidos={seleccionadosData}
          onCerrar={() => { setMostrarModal(false); setSeleccionados([]); }}
        />
      )}
    </div>
  );
}
