import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productosApi } from '../../productos/api/productos.api';
import { campanasApi } from '../../campanas/api/campanas.api';
import { PedidoForm } from '../components/PedidoForm';

// Regla de negocio "brutalmente simple" (00-VISION-NEGOCIO.md): el productor
// no debería tener que entender la diferencia entre "intención" y "solicitud".
// Elige el producto y el sistema decide: si hay una campaña ABIERTA para ese
// producto lo manda ahí; si no, carga un pedido suelto (bottom-up).
export function PedirProductoPage() {
  const navigate = useNavigate();
  const [productoId, setProductoId] = useState('');
  const [pedidoEnviado, setPedidoEnviado] = useState(false);

  const { data: productosData } = useQuery({
    queryKey: ['productos', 'activos'],
    queryFn: () => productosApi.listar({ activo: true, limit: 100 })
  });

  const { data: campanasData, isFetching: buscandoCampana } = useQuery({
    queryKey: ['campanas', 'abiertas', productoId],
    queryFn: () => campanasApi.listar({ estado: 'ABIERTA', productoId, limit: 1 }),
    enabled: !!productoId
  });

  const campanaAbierta = campanasData?.data?.[0];

  if (pedidoEnviado) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4 text-center">
        <p className="text-2xl">✅</p>
        <h2 className="text-lg font-bold">¡Listo! Recibimos tu pedido</h2>
        <p className="text-sm text-gray-600">AUT lo va a revisar para armar una compra colectiva.</p>
        <button onClick={() => navigate('/productor/mis-pedidos')} className="text-aut-verde font-medium text-sm">
          Ver mis pedidos
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 p-4">
      <h2 className="text-lg font-bold">¿Qué producto necesitás?</h2>

      <select
        value={productoId}
        onChange={(e) => setProductoId(e.target.value)}
        className="w-full px-4 py-3 border-2 rounded-lg text-base"
      >
        <option value="">Elegí un producto</option>
        {productosData?.data.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>

      {productoId && buscandoCampana && <p className="text-sm text-gray-500">Buscando compras abiertas...</p>}

      {productoId && !buscandoCampana && campanaAbierta && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 space-y-2">
          <p className="text-sm">Ya hay una compra colectiva abierta para este producto: <strong>{campanaAbierta.nombre}</strong>.</p>
          <button
            onClick={() => navigate(`/productor/campanas/${campanaAbierta.id}`)}
            className="w-full bg-aut-verde text-white py-3 rounded-lg font-semibold"
          >
            Sumarme a esta compra
          </button>
        </div>
      )}

      {productoId && !buscandoCampana && !campanaAbierta && (
        <PedidoForm productoId={Number(productoId)} onGuardado={() => setPedidoEnviado(true)} />
      )}
    </div>
  );
}
