import { useState } from 'react';

export function AprobarProductorModal({ productor, onClose, onAprobar, onRechazar, isLoading }) {
  const [motivo, setMotivo] = useState('');

  if (!productor) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-5 space-y-4">
        <h3 className="font-bold text-lg">{productor.razonSocial}</h3>

        <dl className="text-sm space-y-1 text-gray-700">
          <div><dt className="inline font-medium">CUIT: </dt><dd className="inline">{productor.cuit}</dd></div>
          <div><dt className="inline font-medium">Contacto: </dt><dd className="inline">{productor.usuario?.nombre} {productor.usuario?.apellido}</dd></div>
          <div><dt className="inline font-medium">Email: </dt><dd className="inline">{productor.usuario?.email}</dd></div>
          <div><dt className="inline font-medium">Teléfono: </dt><dd className="inline">{productor.usuario?.telefono || '-'}</dd></div>
          <div><dt className="inline font-medium">Localidad: </dt><dd className="inline">{productor.localidad}</dd></div>
        </dl>

        <div>
          <label className="block text-sm font-medium mb-1">Motivo de rechazo (opcional)</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cerrar</button>
          <button
            onClick={() => onRechazar(productor.id, motivo)}
            disabled={isLoading}
            className="px-4 py-2 text-sm border border-aut-naranja text-aut-naranja rounded-lg disabled:opacity-50"
          >
            Rechazar
          </button>
          <button
            onClick={() => onAprobar(productor.id)}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-aut-verde text-white rounded-lg disabled:opacity-50"
          >
            Aprobar
          </button>
        </div>
      </div>
    </div>
  );
}
