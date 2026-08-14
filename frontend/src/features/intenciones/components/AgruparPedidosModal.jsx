import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { intencionesApi } from '../api/intenciones.api';
import { Modal } from '../../../components/Modal';

function en48Horas() {
  const fecha = new Date(Date.now() + 48 * 60 * 60 * 1000);
  fecha.setSeconds(0, 0);
  return fecha.toISOString().slice(0, 16);
}

export function AgruparPedidosModal({ pedidos, onCerrar }) {
  const queryClient = useQueryClient();

  const porProducto = Object.values(
    pedidos.reduce((acc, p) => {
      const key = p.productoId;
      if (!acc[key]) acc[key] = { productoId: p.productoId, nombre: p.producto?.nombre, unidad: p.producto?.unidadMedida, volumenTotal: 0, cantidad: 0 };
      acc[key].volumenTotal += Number(p.volumen);
      acc[key].cantidad += 1;
      return acc;
    }, {})
  );
  const esLote = porProducto.length > 1;

  const [nombre, setNombre] = useState(
    esLote ? `Lote — ${porProducto.map((p) => p.nombre).join(' + ')}` : `Compra colectiva — ${porProducto[0]?.nombre ?? ''}`
  );
  const [fechaCierre, setFechaCierre] = useState(en48Horas());
  const [fechaEstimadaRecepcion, setFechaEstimadaRecepcion] = useState('');
  const [volumenesPorProducto, setVolumenesPorProducto] = useState(
    () => Object.fromEntries(porProducto.map((p) => [p.productoId, { volumenMinimo: '', volumenMaximo: '' }]))
  );

  function actualizarVolumen(productoId, campo, valor) {
    setVolumenesPorProducto((prev) => ({ ...prev, [productoId]: { ...prev[productoId], [campo]: valor } }));
  }

  const agrupar = useMutation({
    mutationFn: () => intencionesApi.agrupar({
      intencionIds: pedidos.map((p) => p.id),
      nombre,
      fechaCierre: new Date(fechaCierre).toISOString(),
      fechaEstimadaRecepcion: fechaEstimadaRecepcion ? new Date(fechaEstimadaRecepcion).toISOString() : undefined,
      volumenesPorProducto: porProducto.map((p) => ({
        productoId: p.productoId,
        volumenMinimo: volumenesPorProducto[p.productoId]?.volumenMinimo ? Number(volumenesPorProducto[p.productoId].volumenMinimo) : undefined,
        volumenMaximo: volumenesPorProducto[p.productoId]?.volumenMaximo ? Number(volumenesPorProducto[p.productoId].volumenMaximo) : undefined
      }))
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intenciones'] });
      queryClient.invalidateQueries({ queryKey: ['campanas'] });
      onCerrar();
    }
  });

  return (
    <Modal titulo={esLote ? `Agrupar ${pedidos.length} pedidos en un lote de ${porProducto.length} productos` : `Agrupar ${pedidos.length} pedidos`} onCerrar={onCerrar}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{esLote ? 'Nombre del lote' : 'Nombre de la campaña'}</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Fecha de cierre (sugerida: +48hs)</label>
            <input
              type="datetime-local"
              value={fechaCierre}
              onChange={(e) => setFechaCierre(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Recepción estimada (opcional)</label>
            <input
              type="date"
              value={fechaEstimadaRecepcion}
              onChange={(e) => setFechaEstimadaRecepcion(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">{esLote ? 'Volumen por producto' : 'Volumen'}</p>
          {porProducto.map((p) => (
            <div key={p.productoId} className="border rounded-lg p-3 space-y-2">
              <p className="text-sm">
                <span className="font-medium">{p.nombre}</span>
                <span className="text-gray-500"> — {p.cantidad} pedidos, {p.volumenTotal.toLocaleString('es-AR')} {p.unidad?.toLowerCase()} acumulados</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Vol. mínimo (opcional)"
                  value={volumenesPorProducto[p.productoId]?.volumenMinimo ?? ''}
                  onChange={(e) => actualizarVolumen(p.productoId, 'volumenMinimo', e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Vol. máximo (opcional)"
                  value={volumenesPorProducto[p.productoId]?.volumenMaximo ?? ''}
                  onChange={(e) => actualizarVolumen(p.productoId, 'volumenMaximo', e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        {agrupar.isError && (
          <p className="text-red-600 text-sm">{agrupar.error.response?.data?.error?.message || 'Error al agrupar'}</p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => agrupar.mutate()}
            disabled={agrupar.isPending || !nombre.trim() || !fechaCierre}
            className="flex-1 bg-aut-verde text-white py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {agrupar.isPending ? 'Creando...' : esLote ? 'Crear lote' : 'Agrupar pedidos'}
          </button>
          <button onClick={onCerrar} className="px-4 py-2 rounded-lg border font-medium">Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}
