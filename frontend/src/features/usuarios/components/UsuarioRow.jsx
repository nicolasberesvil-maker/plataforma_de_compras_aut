export function UsuarioRow({ usuario, onActivar, onDesactivar, isLoading }) {
  return (
    <tr className="border-b">
      <td className="py-2 px-3 text-sm">{usuario.nombre} {usuario.apellido}</td>
      <td className="py-2 px-3 text-sm text-gray-600">{usuario.username}</td>
      <td className="py-2 px-3 text-sm text-gray-600">{usuario.email}</td>
      <td className="py-2 px-3 text-sm">{usuario.rol}</td>
      <td className="py-2 px-3 text-sm">
        <span className={usuario.activo ? 'text-aut-verde' : 'text-gray-400'}>
          {usuario.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="py-2 px-3 text-sm text-right">
        {usuario.activo ? (
          <button
            onClick={() => onDesactivar(usuario.id)}
            disabled={isLoading}
            className="text-aut-naranja font-medium disabled:opacity-50"
          >
            Desactivar
          </button>
        ) : (
          <button
            onClick={() => onActivar(usuario.id)}
            disabled={isLoading}
            className="text-aut-verde font-medium disabled:opacity-50"
          >
            Activar
          </button>
        )}
      </td>
    </tr>
  );
}
