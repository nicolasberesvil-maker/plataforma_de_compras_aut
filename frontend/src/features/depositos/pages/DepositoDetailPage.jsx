import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { depositosApi } from '../api/depositos.api';
import { StockTable } from '../components/StockTable';
import { RegistrarIngresoForm } from '../components/RegistrarIngresoForm';
import { RegistrarAjusteForm } from '../components/RegistrarAjusteForm';
import { RegistrarTransferenciaForm } from '../components/RegistrarTransferenciaForm';

const ACCIONES = [
  { id: 'ingreso', label: 'Ingreso' },
  { id: 'ajuste', label: 'Ajuste' },
  { id: 'transferencia', label: 'Transferencia' }
];

export function DepositoDetailPage() {
  const { id } = useParams();
  const depositoId = Number(id);
  const [accion, setAccion] = useState('ingreso');

  const { data: depositoData } = useQuery({
    queryKey: ['depositos', id],
    queryFn: () => depositosApi.obtener(id)
  });

  const { data: stockData, isLoading: cargandoStock } = useQuery({
    queryKey: ['depositos', depositoId, 'stock'],
    queryFn: () => depositosApi.obtenerStock(id)
  });

  const deposito = depositoData?.deposito;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{deposito?.nombre}</h2>
          <p className="text-sm text-gray-600">{deposito?.direccion}, {deposito?.localidad}</p>
        </div>
        <Link to="/admin/depositos" className="text-sm text-aut-verde font-medium">Volver</Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3">Stock actual</h3>
          {cargandoStock ? <p className="text-sm text-gray-500">Cargando...</p> : <StockTable stock={stockData?.data} />}
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex gap-2 mb-3">
            {ACCIONES.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccion(a.id)}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  accion === a.id ? 'bg-aut-verde text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {accion === 'ingreso' && <RegistrarIngresoForm depositoId={depositoId} />}
          {accion === 'ajuste' && <RegistrarAjusteForm depositoId={depositoId} />}
          {accion === 'transferencia' && <RegistrarTransferenciaForm depositoId={depositoId} />}
        </div>
      </div>

      <Link to={`/admin/movimientos-stock?depositoId=${depositoId}`} className="text-sm text-aut-verde font-medium">
        Ver historial de movimientos →
      </Link>
    </div>
  );
}
