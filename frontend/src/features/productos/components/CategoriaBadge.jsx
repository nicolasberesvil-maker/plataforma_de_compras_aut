const COLORES = {
  AGROQUIMICO: 'bg-amber-100 text-amber-800',
  FERTILIZANTE: 'bg-emerald-100 text-emerald-800',
  SEMILLA: 'bg-lime-100 text-lime-800',
  INOCULANTE: 'bg-sky-100 text-sky-800',
  NUTRICION_ANIMAL: 'bg-violet-100 text-violet-800',
  SANIDAD_ANIMAL: 'bg-rose-100 text-rose-800',
  OTRO: 'bg-gray-100 text-gray-800'
};

export function CategoriaBadge({ categoria }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COLORES[categoria] ?? COLORES.OTRO}`}>
      {categoria}
    </span>
  );
}
