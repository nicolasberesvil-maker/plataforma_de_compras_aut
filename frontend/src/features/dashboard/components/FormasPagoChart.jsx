import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#1d9e75', '#3B82F6', '#F59E0B', '#8B5CF6', '#06B6D4', '#d85a30', '#6B7280'];

const LABELS = {
  TRANSFERENCIA: 'Transferencia',
  ECHEQ_CORRIENTE: 'ECheq corriente',
  ECHEQ_PLAZO: 'ECheq a plazo',
  TARJETA_AGRO: 'Tarjeta agro',
  CANJE_CEREAL: 'Canje cereal',
  CUENTA_CORRIENTE: 'Cuenta corriente',
  EFECTIVO: 'Efectivo'
};

export function FormasPagoChart({ data }) {
  if (!data?.length) return <p className="text-sm text-gray-500 py-8 text-center">Sin datos.</p>;

  const chartData = data.map((d) => ({ nombre: LABELS[d.formaPago] ?? d.formaPago, cantidad: d.cantidad, montoTotal: d.montoTotal }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}
          dataKey="cantidad" nameKey="nombre"
          label={({ nombre, percent }) => `${nombre} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip
          formatter={(v, _n, p) => [`${v} órdenes · $${p.payload.montoTotal.toLocaleString('es-AR')}`, p.payload.nombre]}
          contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
