import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLogout } from '../features/auth/hooks/useAuth';
import { Campanita } from '../features/notificaciones/components/Campanita';

const TABS = [
  { to: '/admin/usuarios', label: 'Usuarios' },
  { to: '/admin/productores-pendientes', label: 'Productores pendientes' },
  { to: '/admin/proveedores', label: 'Proveedores' },
  { to: '/admin/productos', label: 'Productos' },
  { to: '/admin/campanas', label: 'Campañas' },
  { to: '/admin/solicitudes', label: 'Pedidos sueltos' }
];

export function PanelAdminLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-aut-verde">Panel AUT</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">{usuario?.nombre}</span>
          <Campanita />
          <button onClick={() => logout.mutate()} className="text-aut-naranja font-medium">
            Salir
          </button>
        </div>
      </header>

      <nav className="bg-white border-b px-4 flex gap-4 overflow-x-auto">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                isActive ? 'border-aut-verde text-aut-verde' : 'border-transparent text-gray-600'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
