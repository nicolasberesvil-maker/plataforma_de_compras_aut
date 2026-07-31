import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { facturasApi } from '../api/facturas.api';
import { BotonGenerarFactura } from '../components/BotonGenerarFactura';

const TIPOS = ['', 'A', 'B'];

export function FacturasAdminPage() {
  const [tipo, setTipo] = useState('');
  const [ordenCompraId, setOrdenCompraId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['facturas', { tipo }],
    queryFn: () => facturasApi.listar(tipo ? { tipo } : {})
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold">Facturas</h2>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          {TIPOS.map((t) => <option key={t} value={t}>{t ? `Tipo ${t}` : 'Todos los tipos'}</option>)}
        </select>
      </div>

      <div className="bg-gray-50 border rounded-lg p-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nº de orden de compra</label>
          <input
            type="number" value={ordenCompraId} onChange={(e) => setOrdenCompraId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-40"
          />
        </div>
        {ordenCompraId && <BotonGenerarFactura ordenCompraId={Number(ordenCompraId)} onGenerada={() => setOrdenCompraId('')} />}
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500 uppercase">
                <th className="py-2 px-3">Número</th>
                <th className="py-2 px-3">Productor</th>
                <th className="py-2 px-3">Total</th>
                <th className="py-2 px-3">Fecha</th>
                <th className="py-2 px-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((factura) => (
                <tr key={factura.id} className="border-b last:border-0 text-sm">
                  <td className="py-2 px-3 font-medium">{factura.numero}</td>
                  <td className="py-2 px-3">{factura.ordenCompra?.productor?.razonSocial}</td>
                  <td className="py-2 px-3">${Number(factura.total).toFixed(2)}</td>
                  <td className="py-2 px-3 text-gray-500">{new Date(factura.emitidaAt).toLocaleDateString('es-AR')}</td>
                  <td className="py-2 px-3">
                    <Link to={`/admin/facturas/${factura.id}`} className="text-aut-verde font-medium">Ver</Link>
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 px-3 text-sm text-gray-500 text-center">Sin facturas</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
