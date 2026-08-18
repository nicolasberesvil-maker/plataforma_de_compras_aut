import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DepositosListPage } from './DepositosListPage';
import { MovimientosStockPage } from './MovimientosStockPage';
import { EntregasAdminPage } from '../../entregas/pages/EntregasAdminPage';
import { TransferenciaStockForm } from '../components/TransferenciaStockForm';
import { Tabs } from '../../../components/Tabs';

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
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'depositos' && <DepositosListPage />}
      {tab === 'movimientos' && <MovimientosStockPage />}
      {tab === 'retiros' && <EntregasAdminPage />}
      {tab === 'transferencias' && <TransferenciaStockForm />}
    </div>
  );
}
