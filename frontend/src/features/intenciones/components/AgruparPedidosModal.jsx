import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { intencionesApi } from '../api/intenciones.api';

function en48Horas() {
  const fecha = new Date(Date.now() + 48 * 60 * 60 * 1000);
  fecha.setSeconds(0, 0);
  return fecha.toISOString().slice(0, 16);
}

export function AgruparPedidosModal({ pedidos, onCerrar }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(`Compra colectiva — ${pedidos[0]?.producto?.nombre ?? ''}`);
  const [fechaCierre, setFechaCierre] = useState(en48Horas());
  const [volumenMinimo, setVolumenMinimo] = useState('');

  const agrupar = useMutation({
    mutationFn: () => intencionesApi.agrupar({
      intencionIds: pedidos.map((p) => p.id),
      nombre,
      fechaCierre: new Date(fechaCierre).toISOString(),
      volumenMinimo: volumenMinimo ? Number(volumenMinimo) : undefined
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intenciones'] });
      onCerrar();
    }
  });

  const volumenTotal = pedidos.reduce((acc, p) => acc + Number(p.volumen), 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-30">
      <div className="bg-white rounded-lg p-4 w-full max-w-md space-y-3">
        <h3 className="font-bold">Agrupar {pedidos.length} pedidos en una compra colectiva</h3>
        <p className="text-sm text-gray-600">Producto: {pedidos[0]?.producto?.nombre}. Volumen total: {volumenTotal}.</p>

        <div>
          <label className="block text-sm font-medium mb-1">Nombre de la campaña</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

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
          <label className="block text-sm font-medium mb-1">Volumen mínimo (opcional)</label>
          <input
            type="number"
            value={volumenMinimo}
            onChange={(e) => setVolumenMinimo(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={`Ya hay ${volumenTotal} acumulados`}
          />
        </div>

        {agrupar.isError && (
          <p className="text-red-600 text-sm">{agrupar.error.response?.data?.error?.message || 'Error al agrupar'}</p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => agrupar.mutate()}
            disabled={agrupar.isPending || !nombre.trim() || !fechaCierre}
            className="flex-1 bg-aut-verde text-white py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {agrupar.isPending ? 'Creando...' : 'Crear compra colectiva'}
          </button>
          <button onClick={onCerrar} className="px-4 py-2 rounded-lg border font-medium">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
