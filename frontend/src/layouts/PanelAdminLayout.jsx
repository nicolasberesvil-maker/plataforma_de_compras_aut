import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCircle, Building2, Package, Megaphone,
  Inbox, Warehouse, Receipt, Wallet, Menu, LogOut
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLogout } from '../features/auth/hooks/useAuth';
import { Campanita } from '../features/notificaciones/components/Campanita';

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { to: '/admin/productores', label: 'Productores', icon: UserCircle },
  { to: '/admin/proveedores', label: 'Proveedores', icon: Building2 },
  { to: '/admin/productos', label: 'Productos', icon: Package },
  { to: '/admin/campanas', label: 'Compras', icon: Megaphone },
  { to: '/admin/solicitudes', label: 'Pedidos sueltos', icon: Inbox },
  { to: '/admin/stock', label: 'Stock', icon: Warehouse },
  { to: '/admin/facturas', label: 'Facturas', icon: Receipt },
  { to: '/admin/pagos', label: 'Pagos', icon: Wallet }
];

export function PanelAdminLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useLogout();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      {sidebarAbierto && (
        <div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={() => setSidebarAbierto(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r flex flex-col transition-transform duration-200 md:static md:translate-x-0
          ${sidebarAbierto ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-16 flex items-center px-5 border-b shrink-0">
          <span className="font-bold text-aut-verde text-lg">Panel AUT</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarAbierto(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-aut-verde/10 text-aut-verde' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-3 shrink-0">
          <button
            onClick={() => logout.mutate()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-aut-naranja hover:bg-orange-50"
          >
            <LogOut size={18} />
            Salir
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="bg-white border-b h-16 px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
          <button onClick={() => setSidebarAbierto(true)} className="text-gray-600 md:hidden" aria-label="Abrir menú">
            <Menu size={22} />
          </button>
          <span className="hidden md:block" />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">{usuario?.nombre}</span>
            <Campanita />
          </div>
        </header>

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
