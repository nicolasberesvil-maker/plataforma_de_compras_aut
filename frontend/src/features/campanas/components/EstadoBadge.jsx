const COLORES = {
  BORRADOR: 'bg-gray-100 text-gray-800',
  ABIERTA: 'bg-emerald-100 text-emerald-800',
  EN_LICITACION: 'bg-amber-100 text-amber-800',
  ADJUDICADA: 'bg-sky-100 text-sky-800',
  CERRADA: 'bg-gray-200 text-gray-700',
  CANCELADA: 'bg-rose-100 text-rose-800'
};

const ETIQUETAS = {
  BORRADOR: 'Borrador',
  ABIERTA: 'Abierta',
  EN_LICITACION: 'En licitación',
  ADJUDICADA: 'Adjudicada',
  CERRADA: 'Cerrada',
  CANCELADA: 'Cancelada'
};

export function EstadoBadge({ estado }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COLORES[estado] ?? 'bg-gray-100 text-gray-800'}`}>
      {ETIQUETAS[estado] ?? estado}
    </span>
  );
}
