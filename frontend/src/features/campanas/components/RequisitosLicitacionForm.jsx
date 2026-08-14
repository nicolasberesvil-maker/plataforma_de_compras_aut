import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { campanasApi } from '../api/campanas.api';
import { FORMAS_PAGO } from '../../intenciones/formasPago';

const MODALIDADES = [
  ['RETIRO_EN_DEPOSITO', 'Retiro en depósito de AUT'],
  ['ENTREGA_EN_CAMPO', 'Entrega en el campo']
];

/** Condiciones que faltan antes de poder "Enviar a licitación" — ver campanas.service.js cerrarIntenciones. */
export function RequisitosLicitacionForm({ campana }) {
  const queryClient = useQueryClient();
  const [fechaEstimadaRecepcion, setFechaEstimadaRecepcion] = useState('');
  const [volumenMaximo, setVolumenMaximo] = useState('');
  const [modalidades, setModalidades] = useState([]);
  const [formasPago, setFormasPago] = useState([]);

  const completar = useMutation({
    mutationFn: () => campanasApi.completarRequisitosLicitacion(campana.id, {
      fechaEstimadaRecepcion: new Date(fechaEstimadaRecepcion).toISOString(),
      volumenMaximo: Number(volumenMaximo),
      modalidadesEntregaOfrecidas: modalidades,
      formasPagoOfrecidas: formasPago
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanas', campana.id] });
      queryClient.invalidateQueries({ queryKey: ['campanas'] });
    }
  });

  function toggle(lista, setLista, valor) {
    setLista(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
  }

  const completo = fechaEstimadaRecepcion && volumenMaximo && modalidades.length && formasPago.length;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-amber-900">
        Faltan condiciones para poder enviar esta compra a licitación
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Fecha estimada de recepción</label>
          <input
            type="date"
            value={fechaEstimadaRecepcion}
            onChange={(e) => setFechaEstimadaRecepcion(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Volumen máximo</label>
          <input
            type="number"
            value={volumenMaximo}
            onChange={(e) => setVolumenMaximo(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-1">Modalidad(es) de entrega ofrecida(s)</p>
        <div className="flex flex-wrap gap-2">
          {MODALIDADES.map(([valor, label]) => (
            <label key={valor} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer has-[:checked]:border-aut-verde has-[:checked]:bg-green-50">
              <input type="checkbox" checked={modalidades.includes(valor)} onChange={() => toggle(modalidades, setModalidades, valor)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-1">Forma(s) de pago aceptadas</p>
        <div className="flex flex-wrap gap-2">
          {FORMAS_PAGO.map(([valor, label]) => (
            <label key={valor} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer has-[:checked]:border-aut-verde has-[:checked]:bg-green-50">
              <input type="checkbox" checked={formasPago.includes(valor)} onChange={() => toggle(formasPago, setFormasPago, valor)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      {completar.isError && (
        <p className="text-red-600 text-sm">{completar.error.response?.data?.error?.message || 'Error al guardar'}</p>
      )}

      <button
        onClick={() => completar.mutate()}
        disabled={!completo || completar.isPending}
        className="bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {completar.isPending ? 'Guardando...' : 'Guardar condiciones'}
      </button>
    </div>
  );
}
