import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adjudicacionesApi } from '../api/adjudicaciones.api';
import { ConfirmarAdjudicacionModal } from '../components/ConfirmarAdjudicacionModal';

const MODALIDAD_LABEL = {
  RETIRO_EN_DEPOSITO: 'Retira en depósito',
  ENTREGA_EN_CAMPO: 'Entrega en campo'
};

export function ComparadorPage() {
  const { id: campanaId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [seleccionada, setSeleccionada] = useState(null);
  const [mostrarDestinos, setMostrarDestinos] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['adjudicaciones', 'comparador', campanaId],
    queryFn: () => adjudicacionesApi.obtenerComparador(campanaId)
  });

  const adjudicar = useMutation({
    mutationFn: (datos) => adjudicacionesApi.adjudicar(datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanas'] });
      navigate(`/admin/campanas/${campanaId}`);
    }
  });

  if (isLoading) return <p className="text-gray-500 text-sm">Cargando...</p>;
  if (!data) return <p className="text-gray-500 text-sm">No se pudo cargar el comparador.</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-bold">{data.campana.nombre}</h2>
        <p className="text-sm text-gray-600">{data.campana.producto?.nombre}</p>
      </div>

      <div className="bg-blue-50 rounded-lg p-4 flex gap-6 text-sm">
        <p>Volumen consolidado: <strong>{data.campana.volumenConsolidado} {data.campana.producto?.unidadMedida}</strong></p>
        <p>Productores agrupados: <strong>{data.campana.cantidadProductores}</strong></p>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <button
          onClick={() => setMostrarDestinos((v) => !v)}
          className="text-sm font-medium text-aut-verde"
        >
          {mostrarDestinos ? '▾' : '▸'} Destinos de entrega ({data.destinos?.length ?? 0})
        </button>
        {mostrarDestinos && (
          <div className="mt-3 space-y-2">
            {!data.destinos?.length ? (
              <p className="text-sm text-gray-500">Sin destinos cargados.</p>
            ) : (
              data.destinos.map((d, i) => (
                <div key={i} className="border-b pb-2 last:border-0 last:pb-0 text-sm">
                  <span className="font-medium">{d.productor}</span> — {d.volumen} {data.campana.producto?.unidadMedida?.toLowerCase()}
                  <span className="text-gray-600">
                    {' · '}
                    {MODALIDAD_LABEL[d.modalidadEntregaPreferida] ?? 'Sin preferencia registrada'}
                    {d.modalidadEntregaPreferida === 'ENTREGA_EN_CAMPO' && d.direccionEntregaCampo && ` (${d.direccionEntregaCampo})`}
                    {d.localidad && ` — ${d.localidad}`}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {data.cotizaciones.length === 0 ? (
        <p className="text-gray-500 text-sm">Todavía no hay cotizaciones para esta campaña.</p>
      ) : (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-3">Proveedor</th>
                <th className="p-3 text-right">Precio unit.</th>
                <th className="p-3 text-right">Total estimado</th>
                <th className="p-3 text-center">Plazo (días)</th>
                <th className="p-3 text-left">Condiciones</th>
                <th className="p-3 text-center">Campañas ganadas</th>
                <th className="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {data.cotizaciones.map((c, i) => (
                <tr key={c.id} className={`border-t ${i === 0 ? 'bg-green-50' : ''}`}>
                  <td className="p-3">
                    <p className="font-medium">{c.proveedor.razonSocial}</p>
                    <p className="text-xs text-gray-500">{c.proveedor.cuit}</p>
                  </td>
                  <td className="p-3 text-right">{c.monedaPrecio} {c.precioUnitario.toFixed(4)}</td>
                  <td className="p-3 text-right font-semibold">{c.monedaPrecio} {c.costoTotalEstimado.toFixed(2)}</td>
                  <td className="p-3 text-center">{c.plazoEntregaDias}</td>
                  <td className="p-3 max-w-xs">{c.condicionesPago}</td>
                  <td className="p-3 text-center">{c.campanasGanadasPrevias}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => setSeleccionada(c)}
                      className="bg-aut-verde text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                    >
                      Elegir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seleccionada && (
        <ConfirmarAdjudicacionModal
          cotizacion={seleccionada}
          campana={data.campana}
          pending={adjudicar.isPending}
          onCancelar={() => setSeleccionada(null)}
          onConfirmar={(datos) => adjudicar.mutate(datos)}
        />
      )}
    </div>
  );
}
