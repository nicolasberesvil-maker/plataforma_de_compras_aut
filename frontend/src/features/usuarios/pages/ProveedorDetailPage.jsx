import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { proveedoresApi } from '../api/proveedores.api';
import { RegistrarPagoProveedorForm } from '../components/RegistrarPagoProveedorForm';

function formatearMoneda(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

export function ProveedorDetailPage() {
  const { id } = useParams();
  const [mostrarForm, setMostrarForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: proveedorData } = useQuery({
    queryKey: ['proveedores', id],
    queryFn: () => proveedoresApi.obtener(id)
  });

  const { data: cuenta, isLoading } = useQuery({
    queryKey: ['proveedores', id, 'cuenta-corriente'],
    queryFn: () => proveedoresApi.cuentaCorriente(id)
  });

  const registrarPago = useMutation({
    mutationFn: (datos) => proveedoresApi.registrarPago(id, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores', id, 'cuenta-corriente'] });
      setMostrarForm(false);
    }
  });

  const proveedor = proveedorData?.proveedor;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{proveedor?.razonSocial}</h2>
          <p className="text-sm text-gray-600">{proveedor?.cuit}</p>
        </div>
        <Link to="/admin/proveedores" className="text-sm text-aut-verde font-medium">Volver</Link>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : cuenta && (
        <>
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
            <h3 className="font-semibold text-sm mb-3">Historial de compras</h3>
            {cuenta.historialCompras.length === 0 ? (
              <p className="text-sm text-gray-500">Sin adjudicaciones registradas.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500 uppercase">
                    <th className="py-2 px-3">Compra</th>
                    <th className="py-2 px-3">Producto</th>
                    <th className="py-2 px-3 text-right">Volumen</th>
                    <th className="py-2 px-3 text-right">Precio unit.</th>
                    <th className="py-2 px-3 text-right">Monto</th>
                    <th className="py-2 px-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {cuenta.historialCompras.map((c) => (
                    <tr key={c.adjudicacionId} className="border-b">
                      <td className="py-2 px-3 text-sm">{c.campana}</td>
                      <td className="py-2 px-3 text-sm">{c.producto}</td>
                      <td className="py-2 px-3 text-sm text-right">{c.volumen.toLocaleString('es-AR')}</td>
                      <td className="py-2 px-3 text-sm text-right">{c.precioUnitario.toFixed(4)}</td>
                      <td className="py-2 px-3 text-sm text-right font-medium">{formatearMoneda(c.monto)}</td>
                      <td className="py-2 px-3 text-sm text-gray-600">{new Date(c.fecha).toLocaleDateString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Pagos registrados</h3>
              <button
                onClick={() => setMostrarForm((v) => !v)}
                className="text-sm text-aut-verde font-medium"
              >
                {mostrarForm ? 'Cancelar' : '+ Registrar pago'}
              </button>
            </div>

            {mostrarForm && (
              <RegistrarPagoProveedorForm
                isLoading={registrarPago.isPending}
                onSubmit={(datos) => registrarPago.mutate(datos)}
              />
            )}

            {cuenta.pagos.length === 0 ? (
              <p className="text-sm text-gray-500">Sin pagos registrados.</p>
            ) : (
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
            )}
          </div>
        </>
      )}
    </div>
  );
}
