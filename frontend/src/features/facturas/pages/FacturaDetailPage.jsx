import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { facturasApi } from '../api/facturas.api';
import { BotonDescargarPdf } from '../components/BotonDescargarPdf';
import { useAuthStore } from '../../../store/authStore';

export function FacturaDetailPage() {
  const { id } = useParams();
  const usuario = useAuthStore((s) => s.usuario);
  const esProductor = usuario?.rol === 'PRODUCTOR';

  const { data, isLoading } = useQuery({
    queryKey: ['facturas', id],
    queryFn: () => facturasApi.obtener(id)
  });

  const factura = data?.factura;
  const producto = factura?.ordenCompra?.adjudicacion?.campana?.producto;

  if (isLoading) return <p className="text-gray-500 text-sm p-4">Cargando...</p>;
  if (!factura) return null;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Factura {factura.numero}</h2>
        <Link to={esProductor ? '/productor/mis-facturas' : '/admin/facturas'} className="text-sm text-aut-verde font-medium">
          Volver
        </Link>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold">{producto?.nombre}</p>
            {!esProductor && (
              <p className="text-sm text-gray-600">{factura.ordenCompra?.productor?.razonSocial}</p>
            )}
          </div>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-sky-100 text-sky-800">
            Factura {factura.tipo}
          </span>
        </div>

        <div className="text-sm space-y-1 border-t pt-3">
          {factura.items.map((item) => (
            <p key={item.id}>
              {item.descripcion} — {Number(item.cantidad)} × ${Number(item.precioUnitario).toFixed(4)} = ${Number(item.subtotal).toFixed(2)}
            </p>
          ))}
        </div>

        <div className="text-sm space-y-1 border-t pt-3">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal neto</span><span>${Number(factura.subtotalNeto).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">IVA</span><span>${Number(factura.iva).toFixed(2)}</span></div>
          {factura.percepcionesIIBB && (
            <div className="flex justify-between"><span className="text-gray-500">Percepción IIBB</span><span>${Number(factura.percepcionesIIBB).toFixed(2)}</span></div>
          )}
          <div className="flex justify-between font-semibold text-base pt-1"><span>Total</span><span>${Number(factura.total).toFixed(2)}</span></div>
        </div>

        <p className="text-xs text-gray-500">Emitida el {new Date(factura.emitidaAt).toLocaleDateString('es-AR')}</p>

        <div className="border-t pt-3">
          <BotonDescargarPdf factura={factura} className="bg-aut-verde text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50" />
        </div>
      </div>
    </div>
  );
}
