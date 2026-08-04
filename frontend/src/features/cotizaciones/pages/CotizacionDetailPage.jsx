import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cotizacionesApi } from '../api/cotizaciones.api';

const MODALIDAD_LABEL = {
  RETIRO_EN_DEPOSITO: 'Retira en depósito de AUT',
  ENTREGA_EN_CAMPO: 'Entrega en campo'
};

export function CotizacionDetailPage() {
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['cotizaciones', id],
    queryFn: () => cotizacionesApi.obtener(id)
  });

  const cotizacion = data?.cotizacion;

  if (isLoading) return <p className="p-4 text-gray-500 text-sm">Cargando...</p>;
  if (!cotizacion) return <p className="p-4 text-gray-500 text-sm">No encontrada.</p>;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div>
        <h2 className="text-lg font-bold">{cotizacion.campana.nombre}</h2>
        <p className="text-sm text-gray-600">{cotizacion.campana.producto.nombre}</p>
      </div>

      {cotizacion.esGanadora && (
        <p className="inline-block bg-emerald-100 text-emerald-800 text-xs font-medium px-2 py-1 rounded-full">
          Ganaste esta compra
        </p>
      )}

      <div className="bg-white border rounded-lg p-4 space-y-1 text-sm">
        <p>Precio: <strong>{cotizacion.monedaPrecio} {Number(cotizacion.precioUnitario).toFixed(4)}</strong> por unidad</p>
        <p>Plazo de entrega: {cotizacion.plazoEntregaDias} días</p>
        <p>Condiciones de pago: {cotizacion.condicionesPago}</p>
        <p>Válida hasta: {new Date(cotizacion.validaHasta).toLocaleDateString('es-AR')}</p>
      </div>

      {cotizacion.esGanadora && cotizacion.destinos && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-3">Destinos de entrega</h3>
          {cotizacion.destinos.length === 0 ? (
            <p className="text-sm text-gray-500">Sin destinos cargados.</p>
          ) : (
            <div className="space-y-2">
              {cotizacion.destinos.map((d, i) => (
                <div key={i} className="border-b pb-2 last:border-0 last:pb-0">
                  <p className="text-sm font-medium">{d.productor} — {d.volumen} unidades</p>
                  <p className="text-xs text-gray-600">
                    {MODALIDAD_LABEL[d.modalidadEntregaPreferida] ?? d.modalidadEntregaPreferida ?? 'Sin preferencia registrada'}
                    {d.modalidadEntregaPreferida === 'ENTREGA_EN_CAMPO' && d.direccionEntregaCampo && ` — ${d.direccionEntregaCampo}`}
                    {d.localidad && ` (${d.localidad})`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Link to="/proveedor/mis-cotizaciones" className="text-sm text-aut-verde font-medium">← Volver</Link>
    </div>
  );
}
