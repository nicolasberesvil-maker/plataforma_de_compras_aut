import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { campanasApi } from '../api/campanas.api';
import { transicionesDisponibles } from '../utils/transicionesCampana';

const MONEDAS = ['ARS', 'USD'];

export function AccionesCampana({ campana }) {
  const queryClient = useQueryClient();
  const [formActivo, setFormActivo] = useState(null); // null | 'adjudicar' | 'tanda' | 'cancelar'
  const disponibles = transicionesDisponibles(campana.tipo, campana.estado);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['campanas'] });
    queryClient.invalidateQueries({ queryKey: ['campanas', campana.id] });
  };

  const abrir = useMutation({ mutationFn: () => campanasApi.abrir(campana.id), onSuccess: invalidar });
  const cerrarIntenciones = useMutation({ mutationFn: () => campanasApi.cerrarIntenciones(campana.id), onSuccess: invalidar });
  const adjudicarDirecta = useMutation({
    mutationFn: (datos) => campanasApi.adjudicarDirecta(campana.id, datos),
    onSuccess: () => { invalidar(); setFormActivo(null); }
  });
  const generarTanda = useMutation({
    mutationFn: (datos) => campanasApi.generarTanda(campana.id, datos),
    onSuccess: () => { invalidar(); setFormActivo(null); }
  });
  const cancelar = useMutation({
    mutationFn: (motivo) => campanasApi.cancelar(campana.id, motivo),
    onSuccess: () => { invalidar(); setFormActivo(null); }
  });

  const puede = (estado) => disponibles.includes(estado);
  const pending = abrir.isPending || cerrarIntenciones.isPending || adjudicarDirecta.isPending || generarTanda.isPending || cancelar.isPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {puede('ABIERTA') && (
          <button onClick={() => abrir.mutate()} disabled={pending} className="bg-aut-verde text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
            Abrir
          </button>
        )}
        {puede('EN_LICITACION') && (
          <button onClick={() => cerrarIntenciones.mutate()} disabled={pending} className="bg-aut-verde text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
            Enviar a licitación
          </button>
        )}
        {puede('ADJUDICADA') && campana.tipo === 'DIRECTA' && (
          <button onClick={() => setFormActivo('adjudicar')} disabled={pending} className="bg-sky-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
            Adjudicar
          </button>
        )}
        {puede('ADJUDICADA') && campana.tipo === 'COLECTIVA' && (
          <Link to={`/admin/campanas/${campana.id}/comparador`} className="bg-sky-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
            Comparar y adjudicar
          </Link>
        )}
        {campana.tipo === 'CONTINUA' && campana.estado === 'ABIERTA' && (
          <button onClick={() => setFormActivo('tanda')} disabled={pending} className="bg-sky-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
            Generar tanda
          </button>
        )}
        {puede('CANCELADA') && (
          <button onClick={() => setFormActivo('cancelar')} disabled={pending} className="bg-aut-naranja text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
            Cancelar
          </button>
        )}
        {disponibles.length === 0 && campana.tipo !== 'CONTINUA' && (
          <span className="text-sm text-gray-500">No hay acciones disponibles en este estado.</span>
        )}
      </div>

      {formActivo === 'adjudicar' && (
        <FormAdjudicarDirecta
          onCancelar={() => setFormActivo(null)}
          onConfirmar={(datos) => adjudicarDirecta.mutate(datos)}
          pending={adjudicarDirecta.isPending}
        />
      )}
      {formActivo === 'tanda' && (
        <FormGenerarTanda
          onCancelar={() => setFormActivo(null)}
          onConfirmar={(datos) => generarTanda.mutate(datos)}
          pending={generarTanda.isPending}
        />
      )}
      {formActivo === 'cancelar' && (
        <FormMotivo
          titulo="Motivo de cancelación"
          onCancelar={() => setFormActivo(null)}
          onConfirmar={(motivo) => cancelar.mutate(motivo)}
          pending={cancelar.isPending}
        />
      )}
    </div>
  );
}

function FormAdjudicarDirecta({ onCancelar, onConfirmar, pending }) {
  const [datos, setDatos] = useState({ proveedorId: '', precioUnitario: '', moneda: 'ARS', plazoEntregaDias: '', condicionesPago: '' });

  return (
    <div className="bg-gray-50 border rounded-lg p-3 space-y-2 max-w-md">
      <p className="text-sm font-medium">Adjudicar compra directa</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number" placeholder="ID proveedor" value={datos.proveedorId}
          onChange={(e) => setDatos({ ...datos, proveedorId: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <select value={datos.moneda} onChange={(e) => setDatos({ ...datos, moneda: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">
          {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          type="number" step="0.01" placeholder="Precio unitario" value={datos.precioUnitario}
          onChange={(e) => setDatos({ ...datos, precioUnitario: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="number" placeholder="Plazo entrega (días)" value={datos.plazoEntregaDias}
          onChange={(e) => setDatos({ ...datos, plazoEntregaDias: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <input
        placeholder="Condiciones de pago" value={datos.condicionesPago}
        onChange={(e) => setDatos({ ...datos, condicionesPago: e.target.value })}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onConfirmar({
            proveedorId: Number(datos.proveedorId),
            precioUnitario: Number(datos.precioUnitario),
            moneda: datos.moneda,
            plazoEntregaDias: Number(datos.plazoEntregaDias),
            condicionesPago: datos.condicionesPago
          })}
          disabled={pending}
          className="bg-aut-verde text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {pending ? 'Adjudicando...' : 'Confirmar'}
        </button>
        <button onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-sm font-medium border">Cancelar</button>
      </div>
    </div>
  );
}

function FormGenerarTanda({ onCancelar, onConfirmar, pending }) {
  const [tipoTanda, setTipoTanda] = useState('COLECTIVA');
  const [fechaCierre, setFechaCierre] = useState('');

  return (
    <div className="bg-gray-50 border rounded-lg p-3 space-y-2 max-w-md">
      <p className="text-sm font-medium">Generar tanda</p>
      <select value={tipoTanda} onChange={(e) => setTipoTanda(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
        <option value="COLECTIVA">Colectiva</option>
        <option value="DIRECTA">Directa</option>
      </select>
      {tipoTanda === 'COLECTIVA' && (
        <input
          type="datetime-local" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={() => onConfirmar({ tipoTanda, fechaCierre: fechaCierre || undefined })}
          disabled={pending}
          className="bg-aut-verde text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {pending ? 'Generando...' : 'Confirmar'}
        </button>
        <button onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-sm font-medium border">Cancelar</button>
      </div>
    </div>
  );
}

function FormMotivo({ titulo, onCancelar, onConfirmar, pending }) {
  const [motivo, setMotivo] = useState('');

  return (
    <div className="bg-gray-50 border rounded-lg p-3 space-y-2 max-w-md">
      <p className="text-sm font-medium">{titulo}</p>
      <textarea
        value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onConfirmar(motivo)}
          disabled={pending || motivo.trim().length < 5}
          className="bg-aut-naranja text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {pending ? 'Guardando...' : 'Confirmar'}
        </button>
        <button onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-sm font-medium border">Cancelar</button>
      </div>
    </div>
  );
}
