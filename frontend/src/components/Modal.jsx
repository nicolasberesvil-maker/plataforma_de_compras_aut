import { X } from 'lucide-react';

/**
 * Bottom-sheet en mobile (pantalla completa hasta 90vh), centrado en desktop.
 * El productor maneja la mayoría de esto por celular, así que el layout
 * mobile es el caso principal, no un ajuste secundario.
 */
export function Modal({ titulo, onCerrar, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end sm:items-center justify-center" onClick={onCerrar}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h3 className="font-bold text-base">{titulo}</h3>
          <button onClick={onCerrar} className="text-gray-500 hover:text-gray-700 p-1" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
