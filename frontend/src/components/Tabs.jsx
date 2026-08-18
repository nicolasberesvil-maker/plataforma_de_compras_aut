// Segmented control: pestaña activa con fondo sólido en vez del subrayado
// fino de antes, que pasaba desapercibido en todos los perfiles (admin,
// productor, proveedor, depósito).
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto max-w-full">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors ${
            value === t.id ? 'bg-aut-verde text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
