import { Link } from 'react-router-dom';
import { BotonDescargarPdf } from './BotonDescargarPdf';

const TIPO_STYLES = {
  A: 'bg-sky-100 text-sky-800',
  B: 'bg-green-100 text-green-800'
};

export function FacturaCard({ factura, detailTo }) {
  const producto = factura.ordenCompra?.adjudicacion?.campana?.producto;

  return (
    <div className="bg-white border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{factura.numero}</p>
          {producto && <p className="text-sm text-gray-600">{producto.nombre}</p>}
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${TIPO_STYLES[factura.tipo] ?? ''}`}>
          Factura {factura.tipo}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><span className="text-gray-500">Subtotal: </span>${Number(factura.subtotalNeto).toFixed(2)}</div>
        <div><span className="text-gray-500">IVA: </span>${Number(factura.iva).toFixed(2)}</div>
        {factura.percepcionesIIBB && (
          <div><span className="text-gray-500">Perc. IIBB: </span>${Number(factura.percepcionesIIBB).toFixed(2)}</div>
        )}
        <div className="font-medium"><span className="text-gray-500 font-normal">Total: </span>${Number(factura.total).toFixed(2)}</div>
      </div>

      <p className="text-xs text-gray-500">{new Date(factura.emitidaAt).toLocaleDateString('es-AR')}</p>

      <div className="flex items-center gap-3 pt-1">
        {detailTo && (
          <Link to={detailTo} className="text-sm text-gray-700 font-medium">Ver detalle</Link>
        )}
        <BotonDescargarPdf factura={factura} />
      </div>
    </div>
  );
}
