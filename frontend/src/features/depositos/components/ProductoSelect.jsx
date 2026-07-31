import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productosApi } from '../../productos/api/productos.api';

/** Select de producto con búsqueda por nombre (el catálogo tiene cientos de ítems). */
export function ProductoSelect({ register, name }) {
  const [search, setSearch] = useState('');
  // Si el producto elegido queda afuera de una búsqueda posterior, el navegador
  // remueve su <option> y resetea el <select> a "" perdiendo la selección sin
  // avisar. Lo mantenemos fijado en la lista aunque no matchee el search actual.
  const [seleccionado, setSeleccionado] = useState(null);

  const { data } = useQuery({
    queryKey: ['productos', 'select', search],
    queryFn: () => productosApi.listar({ search: search || undefined, activo: true, limit: 50 })
  });

  const opciones = data?.data ?? [];
  const opcionesVisibles = seleccionado && !opciones.some((p) => p.id === seleccionado.id)
    ? [seleccionado, ...opciones]
    : opciones;

  const { onChange, ...campoRegistrado } = register(name);

  return (
    <div className="space-y-1">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar producto..."
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      <select
        {...campoRegistrado}
        onChange={(e) => {
          onChange(e);
          setSeleccionado(opciones.find((p) => String(p.id) === e.target.value) ?? null);
        }}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      >
        <option value="">Seleccioná un producto</option>
        {opcionesVisibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>
    </div>
  );
}
