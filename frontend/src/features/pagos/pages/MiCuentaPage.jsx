import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productoresApi } from '../../usuarios/api/productores.api';
import { pagosApi } from '../api/pagos.api';
import { DeclararPagoForm } from '../components/DeclararPagoForm';
import { EstadoPagoBadge } from '../components/EstadoPagoBadge';
import { FiltrosFechas } from '../../dashboard/components/FiltrosFechas';

function formatearMoneda(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

function dentroDelRango(fechaIso, desde, hasta) {
  const fecha = fechaIso.slice(0, 10);
  if (desde && fecha < desde) return false;
  if (hasta && fecha > hasta) return false;
  return true;
}

export function MiCuentaPage() {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtros, setFiltros] = useState({ desde: '', hasta: '' });
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

  const hayFiltro = Boolean(filtros.desde || filtros.hasta);

  const ordenesFiltradas = useMemo(
    () => data?.porOrden.filter((o) => dentroDelRango(o.fecha, filtros.desde, filtros.hasta)) ?? [],
    [data, filtros]
  );
  const pagosFiltrados = useMemo(
    () => data?.pagos.filter((p) => dentroDelRango(p.fecha, filtros.desde, filtros.hasta)) ?? [],
    [data, filtros]
  );

  const resumenMostrado = useMemo(() => {
    if (!hayFiltro) return data?.resumen;
    return ordenesFiltradas.reduce(
      (acc, o) => ({
        totalOrdenado: acc.totalOrdenado + o.montoTotal,
        montoTotalAdeudado: acc.montoTotalAdeudado + o.montoPendiente
      }),
      { totalOrdenado: 0, montoTotalAdeudado: 0 }
    );
  }, [data, hayFiltro, ordenesFiltradas]);

  if (isLoading) return <p className="text-gray-500 text-sm p-4">Cargando...</p>;
  if (!data) return null;

  const ordenesPendientes = data.porOrden.filter((o) => o.montoPendiente > 0);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Mi cuenta</h2>

      <FiltrosFechas filtros={filtros} onChange={setFiltros} />

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Total comprado</p>
          <p className="text-xl font-bold mt-1">{formatearMoneda(resumenMostrado.totalOrdenado)}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase">Adeudado</p>
          <p className={`text-xl font-bold mt-1 ${resumenMostrado.montoTotalAdeudado > 0 ? 'text-aut-naranja' : ''}`}>
            {formatearMoneda(resumenMostrado.montoTotalAdeudado)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3">Mis órdenes</h3>
          {ordenesFiltradas.length === 0 ? (
            <p className="text-sm text-gray-500">{hayFiltro ? 'No hay órdenes en ese rango de fechas.' : 'Todavía no tenés órdenes.'}</p>
          ) : (
            <div className="divide-y">
              {ordenesFiltradas.map((o) => (
                <div key={o.ordenCompraId} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{o.producto}</p>
                    <p className="text-xs text-gray-500">{new Date(o.fecha).toLocaleDateString('es-AR')}</p>
                  </div>
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatearMoneda(o.montoTotal)}</span>
                      <EstadoPagoBadge estado={o.estadoPago} />
                    </div>
                    {o.montoPendiente > 0 && (
                      <span className="text-xs text-aut-naranja">Pendiente: {formatearMoneda(o.montoPendiente)}</span>
                    )}
                  </div>
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

          {pagosFiltrados.length === 0 ? (
            <p className="text-sm text-gray-500">{hayFiltro ? 'No hay pagos en ese rango de fechas.' : 'Todavía no declaraste ningún pago.'}</p>
          ) : (
            <div className="space-y-3">
              {pagosFiltrados.map((p) => (
                <div key={p.id} className="border rounded-lg p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{formatearMoneda(Number(p.montoTotal))}</span>
                    <EstadoPagoBadge estado={p.estado} />
                  </div>
                  <p className="text-gray-500 text-xs">{new Date(p.fecha).toLocaleDateString('es-AR')}</p>
                  <p className="text-gray-600 text-xs break-words">
                    {p.aplicaciones.map((a) => a.ordenCompra?.adjudicacion?.campana?.producto?.nombre).filter(Boolean).join(', ')}
                  </p>
                  <p className="text-gray-600 text-xs break-words">
                    {p.medios.map((m) => `${m.formaPago}: ${formatearMoneda(Number(m.monto))}`).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
