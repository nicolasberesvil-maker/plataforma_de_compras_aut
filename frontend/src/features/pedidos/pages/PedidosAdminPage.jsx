import { useState } from 'react';
import { BandejaPedidosPage } from '../../intenciones/pages/BandejaPedidosPage';
import { CampanasListPage } from '../../campanas/pages/CampanasListPage';

const TABS = [
  { id: 'sueltos', label: 'Pedidos de productores' },
  { id: 'agrupadas', label: 'Agrupados / enviados a proveedor' },
  { id: 'concretadas', label: 'Órdenes concretadas' }
];

export function PedidosAdminPage() {
  const [tab, setTab] = useState('sueltos');

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Pedidos</h2>

      <div className="flex gap-2 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === t.id ? 'border-aut-verde text-aut-verde' : 'border-transparent text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sueltos' && <BandejaPedidosPage />}
      {tab === 'agrupadas' && <CampanasListPage vista="agrupadas" />}
      {tab === 'concretadas' && <CampanasListPage vista="concretadas" />}
    </div>
  );
}
