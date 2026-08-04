import { useQuery } from '@tanstack/react-query';
import { proveedoresApi } from '../api/proveedores.api';

function formatearMoneda(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

export function MiCuentaProveedorPage() {
  const { data: cuenta, isLoading } = useQuery({
    queryKey: ['proveedores', 'mi-cuenta'],
    queryFn: () => proveedoresApi.miCuenta()
  });

  if (isLoading) return <p className="text-gray-500 text-sm">Cargando...</p>;
  if (!cuenta) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Mi cuenta</h2>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Total adjudicado</p>
          <p className="text-lg font-bold">{formatearMoneda(cuenta.resumen.totalAdjudicado)}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Total pagado</p>
          <p className="text-lg font-bold text-aut-verde">{formatearMoneda(cuenta.resumen.totalPagado)}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Saldo pendiente</p>
          <p className={`text-lg font-bold ${cuenta.resumen.saldoPendiente > 0 ? 'text-aut-naranja' : ''}`}>
            {formatearMoneda(cuenta.resumen.saldoPendiente)}
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-sm mb-3">Pagos recibidos</h3>
        {cuenta.pagos.length === 0 ? (
          <p className="text-sm text-gray-500">AUT todavía no te registró ningún pago.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500 uppercase">
                  <th className="py-2 px-3">Fecha</th>
                  <th className="py-2 px-3 text-right">Monto</th>
                  <th className="py-2 px-3">Medio</th>
                  <th className="py-2 px-3">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {cuenta.pagos.map((p) => (
                  <tr key={p.pagoProveedorId} className="border-b">
                    <td className="py-2 px-3 text-sm text-gray-600">{new Date(p.fecha).toLocaleDateString('es-AR')}</td>
                    <td className="py-2 px-3 text-sm text-right font-medium">{formatearMoneda(p.monto)}</td>
                    <td className="py-2 px-3 text-sm">{p.medioPago}</td>
                    <td className="py-2 px-3 text-sm text-gray-600">{p.observaciones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
