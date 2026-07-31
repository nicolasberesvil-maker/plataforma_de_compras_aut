export function KpiCard({ titulo, valor, subtexto, color = '#1d9e75' }) {
  return (
    <div className="bg-white rounded-lg border p-4" style={{ borderLeft: `4px solid ${color}` }}>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{titulo}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{valor}</p>
      {subtexto && <p className="text-xs text-gray-500 mt-1">{subtexto}</p>}
    </div>
  );
}
