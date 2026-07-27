const COLORES = {
  COLECTIVA: 'bg-emerald-100 text-emerald-800',
  DIRECTA: 'bg-sky-100 text-sky-800',
  CONTINUA: 'bg-violet-100 text-violet-800'
};

const ETIQUETAS = {
  COLECTIVA: 'Colectiva',
  DIRECTA: 'Directa',
  CONTINUA: 'Continua'
};

export function TipoBadge({ tipo }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COLORES[tipo] ?? 'bg-gray-100 text-gray-800'}`}>
      {ETIQUETAS[tipo] ?? tipo}
    </span>
  );
}
