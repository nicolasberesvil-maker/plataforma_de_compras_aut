import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLogout } from '../features/auth/hooks/useAuth';
import { Campanita } from '../features/notificaciones/components/Campanita';

const TABS = [
  { to: '/proveedor', label: 'Licitaciones', icon: '📋', end: true },
  { to: '/proveedor/mis-cotizaciones', label: 'Mis cotizaciones', icon: '💵' },
  { to: '/perfil', label: 'Perfil', icon: '👤' }
];

export function PanelProveedorLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-aut-verde">AUT Compras</h1>
          <p className="text-xs text-gray-500">{usuario?.nombre}</p>
        </div>
        <div className="flex items-center gap-1">
          <Campanita />
          <button onClick={() => logout.mutate()} className="text-aut-naranja text-sm font-medium px-2">
            Salir
          </button>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex z-10">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                isActive ? 'text-aut-verde' : 'text-gray-500'
              }`
            }
          >
            <span className="text-lg">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
