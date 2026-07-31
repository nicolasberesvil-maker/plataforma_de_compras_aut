import { useQuery } from '@tanstack/react-query';
import { depositosApi } from '../../depositos/api/depositos.api';

const ESTADOS = ['PENDIENTE', 'EN_TRANSITO', 'DISPONIBLE_PARA_RETIRO', 'EN_RUTA_A_CAMPO', 'ENTREGADA', 'CANCELADA'];

export function FiltrosEntregas({ filtros, onChange }) {
  const { data: depositosData } = useQuery({
    queryKey: ['depositos', { activo: 'true' }],
    queryFn: () => depositosApi.listar({ activo: 'true' })
  });

  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={filtros.depositoId ?? ''}
        onChange={(e) => onChange({ ...filtros, depositoId: e.target.value || undefined })}
        className="border rounded-lg px-3 py-2 text-sm"
      >
        <option value="">Todos los depósitos</option>
        {depositosData?.data.map((d) => (
          <option key={d.id} value={d.id}>{d.nombre}</option>
        ))}
      </select>

      <select
        value={filtros.estado ?? ''}
        onChange={(e) => onChange({ ...filtros, estado: e.target.value || undefined })}
        className="border rounded-lg px-3 py-2 text-sm"
      >
        <option value="">Todos los estados</option>
        {ESTADOS.map((estado) => (
          <option key={estado} value={estado}>{estado}</option>
        ))}
      </select>
    </div>
  );
}
