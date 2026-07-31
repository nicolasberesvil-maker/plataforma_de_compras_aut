import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { entregasApi } from '../api/entregas.api';
import { depositosApi } from '../../depositos/api/depositos.api';
import { EstadoEntregaBadge } from './EstadoEntregaBadge';
import { ConfirmarRetiroForm } from './ConfirmarRetiroForm';

function mensajeError(err, fallback) {
  return err?.response?.data?.error?.message || fallback;
}

export function EntregaRow({ entrega }) {
  const [formularioAbierto, setFormularioAbierto] = useState(null); // 'retiro' | 'campo' | null
  const [depositoElegido, setDepositoElegido] = useState('');
  const queryClient = useQueryClient();

  const producto = entrega.ordenCompra?.adjudicacion?.campana?.producto;
  const nombreProductor = entrega.productor?.usuario
    ? `${entrega.productor.usuario.nombre} ${entrega.productor.usuario.apellido ?? ''}`.trim()
    : '—';

  const { data: depositosData } = useQuery({
    queryKey: ['depositos', { activo: 'true' }],
    queryFn: () => depositosApi.listar({ activo: 'true' }),
    enabled: entrega.modalidad === 'RETIRO_EN_DEPOSITO' && !entrega.depositoId
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['entregas'] });

  const enTransito = useMutation({
    mutationFn: () => entregasApi.marcarEnTransito(entrega.id, depositoElegido ? { depositoId: Number(depositoElegido) } : {}),
    onSuccess: invalidar
  });

  const disponible = useMutation({
    mutationFn: () => entregasApi.marcarDisponible(entrega.id, depositoElegido ? { depositoId: Number(depositoElegido) } : {}),
    onSuccess: invalidar
  });

  const retiro = useMutation({
    mutationFn: (datos) => entregasApi.confirmarRetiro(entrega.id, datos),
    onSuccess: () => { invalidar(); setFormularioAbierto(null); }
  });

  const entregaCampo = useMutation({
    mutationFn: (datos) => entregasApi.confirmarEntregaCampo(entrega.id, datos),
    onSuccess: () => { invalidar(); setFormularioAbierto(null); }
  });

  const cancelar = useMutation({
    mutationFn: (motivo) => entregasApi.cancelar(entrega.id, motivo),
    onSuccess: invalidar
  });

  function handleCancelar() {
    const motivo = window.prompt('Motivo de la cancelación:');
    if (motivo) cancelar.mutate(motivo);
  }

  const requiereDeposito = entrega.modalidad === 'RETIRO_EN_DEPOSITO' && !entrega.depositoId;
  const esTerminal = entrega.estado === 'ENTREGADA' || entrega.estado === 'CANCELADA';

  return (
    <>
      <tr className="border-b align-top">
        <td className="py-2 px-3 text-sm">
          <Link to={`/admin/entregas/${entrega.id}`} className="text-aut-verde font-medium">
            {producto?.nombre}
          </Link>
          <p className="text-gray-500">{Number(entrega.ordenCompra?.volumenFinal)} {producto?.unidadMedida}</p>
        </td>
        <td className="py-2 px-3 text-sm">{nombreProductor}</td>
        <td className="py-2 px-3 text-sm">{entrega.modalidad === 'RETIRO_EN_DEPOSITO' ? (entrega.deposito?.nombre ?? 'Sin asignar') : 'Entrega en campo'}</td>
        <td className="py-2 px-3"><EstadoEntregaBadge estado={entrega.estado} /></td>
        <td className="py-2 px-3 text-sm space-y-1">
          {requiereDeposito && !esTerminal && (
            <select
              value={depositoElegido}
              onChange={(e) => setDepositoElegido(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs w-full"
            >
              <option value="">Elegir depósito...</option>
              {depositosData?.data.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          )}

          <div className="flex flex-wrap gap-2">
            {entrega.estado === 'PENDIENTE' && (
              <button
                onClick={() => enTransito.mutate()}
                disabled={enTransito.isPending}
                className="text-sky-700 font-medium disabled:opacity-50"
              >
                En tránsito
              </button>
            )}

            {entrega.modalidad === 'RETIRO_EN_DEPOSITO' && ['PENDIENTE', 'EN_TRANSITO'].includes(entrega.estado) && (
              <button
                onClick={() => disponible.mutate()}
                disabled={disponible.isPending || (requiereDeposito && !depositoElegido)}
                className="text-aut-verde font-medium disabled:opacity-50"
              >
                Disponible
              </button>
            )}

            {entrega.modalidad === 'RETIRO_EN_DEPOSITO' && entrega.estado === 'DISPONIBLE_PARA_RETIRO' && (
              <button onClick={() => setFormularioAbierto('retiro')} className="text-aut-verde font-medium">
                Confirmar retiro
              </button>
            )}

            {entrega.modalidad === 'ENTREGA_EN_CAMPO' && ['EN_TRANSITO', 'EN_RUTA_A_CAMPO'].includes(entrega.estado) && (
              <button onClick={() => setFormularioAbierto('campo')} className="text-aut-verde font-medium">
                Confirmar entrega
              </button>
            )}

            {!esTerminal && (
              <button onClick={handleCancelar} disabled={cancelar.isPending} className="text-red-600 font-medium disabled:opacity-50">
                Cancelar
              </button>
            )}
          </div>

          {(enTransito.isError || disponible.isError || cancelar.isError) && (
            <p className="text-red-600 text-xs">
              {mensajeError(enTransito.error || disponible.error || cancelar.error, 'No se pudo actualizar la entrega')}
            </p>
          )}
        </td>
      </tr>

      {formularioAbierto && (
        <tr className="border-b">
          <td colSpan={5} className="py-2 px-3">
            <ConfirmarRetiroForm
              cargando={formularioAbierto === 'retiro' ? retiro.isPending : entregaCampo.isPending}
              error={
                formularioAbierto === 'retiro'
                  ? retiro.isError && mensajeError(retiro.error, 'No se pudo confirmar el retiro')
                  : entregaCampo.isError && mensajeError(entregaCampo.error, 'No se pudo confirmar la entrega')
              }
              onCancelar={() => setFormularioAbierto(null)}
              onConfirmar={(datos) => (formularioAbierto === 'retiro' ? retiro.mutate(datos) : entregaCampo.mutate(datos))}
            />
          </td>
        </tr>
      )}
    </>
  );
}
