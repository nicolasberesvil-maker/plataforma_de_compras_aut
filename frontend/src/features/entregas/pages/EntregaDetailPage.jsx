import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { entregasApi } from '../api/entregas.api';
import { EstadoEntregaBadge } from '../components/EstadoEntregaBadge';
import { BotonGenerarFactura } from '../../facturas/components/BotonGenerarFactura';
import { useAuthStore } from '../../../store/authStore';

export function EntregaDetailPage() {
  const { id } = useParams();
  const usuario = useAuthStore((s) => s.usuario);
  const rol = usuario?.rol;
  const esOperadorDeposito = rol === 'OPERADOR_DEPOSITO';
  const puedeVerProductor = ['ADMIN', 'OPERADOR_DEPOSITO'].includes(rol);
  const puedeFacturar = rol === 'ADMIN';
  const volverA = esOperadorDeposito ? '/deposito' : puedeFacturar ? '/admin/stock?tab=retiros' : '/productor/mis-entregas';

  const { data, isLoading } = useQuery({
    queryKey: ['entregas', id],
    queryFn: () => entregasApi.obtener(id)
  });

  const entrega = data?.entrega;
  const producto = entrega?.ordenCompra?.adjudicacion?.campana?.producto;

  if (isLoading) return <p className="text-gray-500 text-sm p-4">Cargando...</p>;
  if (!entrega) return null;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Detalle de entrega</h2>
        <Link to={volverA} className="text-sm text-aut-verde font-medium">
          Volver
        </Link>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold">{producto?.nombre}</p>
            <p className="text-sm text-gray-600">{Number(entrega.ordenCompra?.volumenFinal)} {producto?.unidadMedida}</p>
          </div>
          <EstadoEntregaBadge estado={entrega.estado} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">Modalidad: </span>{entrega.modalidad === 'RETIRO_EN_DEPOSITO' ? 'Retiro en depósito' : 'Entrega en campo'}</div>
          {puedeVerProductor && <div><span className="text-gray-500">Productor: </span>{entrega.productor?.usuario?.nombre} {entrega.productor?.usuario?.apellido}</div>}
        </div>

        {entrega.modalidad === 'RETIRO_EN_DEPOSITO' && entrega.deposito && (
          <div className="bg-blue-50 p-3 rounded text-sm">
            <p className="font-medium">📍 {entrega.deposito.nombre}</p>
            <p>{entrega.deposito.direccion}, {entrega.deposito.localidad}</p>
            {entrega.deposito.horarioAtencion && <p className="text-gray-600 mt-1">🕐 {entrega.deposito.horarioAtencion}</p>}
          </div>
        )}

        {entrega.estado === 'ENTREGADA' && (
          <div className="text-sm space-y-1 border-t pt-3">
            <p className="font-medium">Recibió: {entrega.recibidaPorNombre} (DNI {entrega.recibidaPorDni})</p>
            {entrega.observaciones && <p className="text-gray-600">{entrega.observaciones}</p>}
            {entrega.fechaEntregadaAt && <p className="text-gray-500">{new Date(entrega.fechaEntregadaAt).toLocaleString('es-AR')}</p>}
          </div>
        )}

        {entrega.estado === 'CANCELADA' && entrega.observaciones && (
          <div className="text-sm border-t pt-3">
            <p className="text-red-600 font-medium">Motivo de cancelación: {entrega.observaciones}</p>
          </div>
        )}

        {puedeFacturar && entrega.estado === 'ENTREGADA' && (
          <div className="border-t pt-3">
            <BotonGenerarFactura ordenCompraId={entrega.ordenCompra.id} />
          </div>
        )}
      </div>
    </div>
  );
}
