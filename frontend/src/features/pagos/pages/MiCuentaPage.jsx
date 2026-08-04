import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productoresApi } from '../../usuarios/api/productores.api';
import { pagosApi } from '../api/pagos.api';
import { DeclararPagoForm } from '../components/DeclararPagoForm';
import { EstadoPagoBadge } from '../components/EstadoPagoBadge';

function formatearMoneda(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

export function MiCuentaPage() {
  const [mostrarForm, setMostrarForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['productores', 'mi-cuenta'],
    queryFn: () => productoresApi.miCuenta()
  });

  const declararPago = useMutation({
    mutationFn: (datos) => pagosApi.crear(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productores', 'mi-cuenta'] });
      setMostrarForm(false);
    }
  });

  if (isLoading) return <p className="text-gray-500 text-sm p-4">Cargando...</p>;
  if (!data) return null;

  const ordenesPendientes = data.porOrden.filter((o) => o.montoPendiente > 0);

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-lg font-bold">Mi cuenta</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase">Total comprado</p>
          <p className="text-lg font-bold">{formatearMoneda(data.resumen.totalOrdenado)}</p>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase">Adeudado</p>
          <p className={`text-lg font-bold ${data.resumen.montoTotalAdeudado > 0 ? 'text-aut-naranja' : ''}`}>
            {formatearMoneda(data.resumen.montoTotalAdeudado)}
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-sm mb-3">Mis órdenes</h3>
        {data.porOrden.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no tenés órdenes.</p>
        ) : (
          <div className="space-y-2">
            {data.porOrden.map((o) => (
              <div key={o.ordenCompraId} className="flex items-center justify-between text-sm border-b pb-2">
                <span>{o.producto}</span>
                <span className="text-right">
                  <span className="block">{formatearMoneda(o.montoTotal)} <span className="text-xs text-gray-500">({o.estadoPago})</span></span>
                  {o.montoPendiente > 0 && (
                    <span className="block text-xs text-aut-naranja">Pendiente: {formatearMoneda(o.montoPendiente)}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Pagos</h3>
          <button onClick={() => setMostrarForm((v) => !v)} className="text-sm text-aut-verde font-medium">
            {mostrarForm ? 'Cancelar' : '+ Declarar pago'}
          </button>
        </div>

        {mostrarForm && (
          <DeclararPagoForm
            ordenes={ordenesPendientes}
            isLoading={declararPago.isPending}
            error={declararPago.isError && (declararPago.error.response?.data?.error?.message || 'Error al declarar el pago')}
            onSubmit={(datos) => declararPago.mutate(datos)}
          />
        )}

        {data.pagos.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no declaraste ningún pago.</p>
        ) : (
          <div className="space-y-3">
            {data.pagos.map((p) => (
              <div key={p.id} className="border rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{formatearMoneda(Number(p.montoTotal))}</span>
                  <EstadoPagoBadge estado={p.estado} />
                </div>
                <p className="text-gray-500 text-xs">{new Date(p.fecha).toLocaleDateString('es-AR')}</p>
                <p className="text-gray-600 text-xs">
                  {p.aplicaciones.map((a) => a.ordenCompra?.adjudicacion?.campana?.producto?.nombre).filter(Boolean).join(', ')}
                </p>
                <p className="text-gray-600 text-xs">
                  {p.medios.map((m) => `${m.formaPago}: ${formatearMoneda(Number(m.monto))}`).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
