import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLOR = '#1d9e75';

function TooltipVolumen({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900">{d.nombre}</p>
      <p className="text-gray-600">Volumen: {d.volumenTotal.toLocaleString('es-AR')} {d.unidadMedida}</p>
      <p className="text-gray-600">Monto: ${d.montoTotal.toLocaleString('es-AR')}</p>
    </div>
  );
}

export function VolumenPorInsumoChart({ data }) {
  if (!data?.length) return <p className="text-sm text-gray-500 py-8 text-center">Sin datos en el período.</p>;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="nombre" tick={{ fill: '#374151', fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
        <Tooltip content={<TooltipVolumen />} />
        <Bar dataKey="montoTotal" radius={[0, 6, 6, 0]} maxBarSize={28} fill={COLOR} />
      </BarChart>
    </ResponsiveContainer>
  );
}
