import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { BandejaPedidosPage } from '../../intenciones/pages/BandejaPedidosPage';
import { CampanasListPage } from '../../campanas/pages/CampanasListPage';
import { Tabs } from '../../../components/Tabs';

const TABS = [
  { id: 'sueltos', label: 'Pedidos de productores' },
  { id: 'abiertas', label: 'Agrupados' },
  { id: 'en-licitacion', label: 'Pedidos enviados a cotizar' }
];

export function PedidosAdminPage() {
  const [tab, setTab] = useState('sueltos');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Pedidos</h2>
        <Link
          to="/admin/campanas/nueva"
          className="flex items-center gap-2 bg-aut-verde text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:brightness-95"
        >
          <Plus size={18} /> Crear pedido
        </Link>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'sueltos' && <BandejaPedidosPage />}
      {tab === 'abiertas' && <CampanasListPage vista="abiertas" />}
      {tab === 'en-licitacion' && <CampanasListPage vista="en-licitacion" />}
    </div>
  );
}
