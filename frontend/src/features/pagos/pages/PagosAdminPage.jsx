import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pagosApi } from '../api/pagos.api';
import { productoresApi } from '../../usuarios/api/productores.api';
import { EstadoPagoBadge } from '../components/EstadoPagoBadge';
import { DeclararPagoForm } from '../components/DeclararPagoForm';

function formatearMoneda(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
}

export function PagosAdminPage() {
  const [estado, setEstado] = useState('DECLARADO');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [productorId, setProductorId] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['pagos', { estado }],
    queryFn: () => pagosApi.listar({ estado: estado || undefined })
  });

  const { data: productoresData } = useQuery({
    queryKey: ['productores', 'activos-para-pago'],
    queryFn: () => productoresApi.listar({ limit: 200 }),
    enabled: mostrarForm
  });

  const { data: cuentaData, isFetching: cargandoCuenta } = useQuery({
    queryKey: ['productores', productorId, 'cuenta-corriente'],
    queryFn: () => productoresApi.cuentaCorriente(productorId),
    enabled: !!productorId
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['pagos'] });

  const cargarPago = useMutation({
    mutationFn: (datos) => pagosApi.crear({ ...datos, productorId: Number(productorId) }),
    onSuccess: () => {
      invalidar();
      setMostrarForm(false);
      setProductorId('');
    }
  });

  const confirmar = useMutation({
    mutationFn: (id) => pagosApi.confirmar(id),
    onSuccess: invalidar
  });

  const rechazar = useMutation({
    mutationFn: ({ id, motivo }) => pagosApi.rechazar(id, motivo),
    onSuccess: invalidar
  });

  function handleRechazar(id) {
    const motivo = window.prompt('Motivo del rechazo:');
    if (motivo) rechazar.mutate({ id, motivo });
  }

  const pagos = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold">Pagos</h2>
        <div className="flex items-center gap-3">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Todos los estados</option>
            <option value="DECLARADO">Declarados</option>
            <option value="CONFIRMADO">Confirmados</option>
            <option value="RECHAZADO">Rechazados</option>
          </select>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="bg-aut-verde text-white px-3 py-2 rounded-lg text-sm font-medium"
          >
            {mostrarForm ? 'Cancelar' : '+ Cargar pago'}
          </button>
        </div>
      </div>

      {mostrarForm && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Productor</label>
            <select
              value={productorId}
              onChange={(e) => setProductorId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Elegí un productor</option>
              {productoresData?.data.map((p) => <option key={p.id} value={p.id}>{p.razonSocial}</option>)}
            </select>
          </div>

          {productorId && cargandoCuenta && <p className="text-sm text-gray-500">Cargando cuenta corriente...</p>}

          {productorId && cuentaData && (
            <DeclararPagoForm
              ordenes={cuentaData.porOrden.filter((o) => o.montoPendiente > 0)}
              isLoading={cargarPago.isPending}
              error={cargarPago.isError && (cargarPago.error.response?.data?.error?.message || 'Error al cargar el pago')}
              onSubmit={(datos) => cargarPago.mutate(datos)}
            />
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : pagos.length === 0 ? (
        <p className="text-sm text-gray-500">Sin pagos.</p>
      ) : (
        <div className="space-y-3">
          {pagos.map((p) => (
            <div key={p.id} className="bg-white border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{p.productor?.razonSocial}</p>
                  <p className="text-xs text-gray-500">{new Date(p.fecha).toLocaleDateString('es-AR')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{formatearMoneda(Number(p.montoTotal))}</span>
                  <EstadoPagoBadge estado={p.estado} />
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p><span className="text-gray-500">Aplicado a: </span>
                  {p.aplicaciones.map((a) => `${a.ordenCompra?.adjudicacion?.campana?.producto?.nombre ?? `Orden #${a.ordenCompraId}`} (${formatearMoneda(Number(a.montoAplicado))})`).join(', ')}
                </p>
                <p><span className="text-gray-500">Medios: </span>
                  {p.medios.map((m) => `${m.formaPago}: ${formatearMoneda(Number(m.monto))}`).join(' · ')}
                </p>
                {p.observaciones && <p><span className="text-gray-500">Obs: </span>{p.observaciones}</p>}
              </div>

              {p.estado === 'DECLARADO' && (
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => confirmar.mutate(p.id)}
                    disabled={confirmar.isPending}
                    className="text-aut-verde text-sm font-medium disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => handleRechazar(p.id)}
                    disabled={rechazar.isPending}
                    className="text-red-600 text-sm font-medium disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              )}

              {(confirmar.isError || rechazar.isError) && (
                <p className="text-red-600 text-xs">
                  {(confirmar.error || rechazar.error)?.response?.data?.error?.message || 'No se pudo actualizar el pago'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
