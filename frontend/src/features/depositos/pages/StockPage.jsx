import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DepositosListPage } from './DepositosListPage';
import { MovimientosStockPage } from './MovimientosStockPage';
import { EntregasAdminPage } from '../../entregas/pages/EntregasAdminPage';
import { TransferenciaStockForm } from '../components/TransferenciaStockForm';

const TABS = [
  { id: 'depositos', label: 'Depósitos' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'retiros', label: 'Retiros / Entregas' },
  { id: 'transferencias', label: 'Transferencias' }
];

export function StockPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'depositos');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id ? 'border-aut-verde text-aut-verde' : 'border-transparent text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'depositos' && <DepositosListPage />}
      {tab === 'movimientos' && <MovimientosStockPage />}
      {tab === 'retiros' && <EntregasAdminPage />}
      {tab === 'transferencias' && <TransferenciaStockForm />}
    </div>
  );
}
