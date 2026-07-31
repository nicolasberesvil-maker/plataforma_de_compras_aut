import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLogout } from '../features/auth/hooks/useAuth';
import { Campanita } from '../features/notificaciones/components/Campanita';

// Panel acotado para OPERADOR_DEPOSITO: solo ve entregas (remitos, qué está
// pendiente de despacho/retiro), no el resto de la operación de AUT. El
// backend ya restringe sus permisos a esto (ver entregas.routes.js); este
// layout evita mostrarle en el front secciones a las que no puede entrar.
export function PanelDepositoLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-aut-verde">Depósito AUT</h1>
          <p className="text-xs text-gray-500">{usuario?.nombre}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Campanita />
          <button onClick={() => logout.mutate()} className="text-aut-naranja font-medium">
            Salir
          </button>
        </div>
      </header>

      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
