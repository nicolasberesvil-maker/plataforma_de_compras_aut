import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  ShoppingCart, BarChart3, PlusCircle, ClipboardList, FileText,
  Package, Receipt, CreditCard, UserCircle, Menu, LogOut
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLogout } from '../features/auth/hooks/useAuth';
import { Campanita } from '../features/notificaciones/components/Campanita';
import { useNotificacionesPorSeccion } from '../features/notificaciones/hooks/useNotificacionesPorSeccion';

const NAV_GROUPS = [
  {
    title: 'Principal',
    items: [
      { to: '/productor', label: 'Compras', icon: ShoppingCart, end: true },
      { to: '/productor/resumen', label: 'Resumen', icon: BarChart3 }
    ]
  },
  {
    title: 'Pedidos',
    items: [
      { to: '/productor/mis-pedidos', label: 'Mis pedidos', icon: ClipboardList },
      { to: '/productor/mis-ordenes', label: 'Mis órdenes', icon: FileText },
      { to: '/productor/mis-entregas', label: 'Mis entregas', icon: Package }
    ]
  },
  {
    title: 'Cuenta',
    items: [
      { to: '/productor/mis-facturas', label: 'Mis facturas', icon: Receipt },
      { to: '/productor/mi-cuenta', label: 'Mi cuenta', icon: CreditCard },
      { to: '/perfil', label: 'Perfil', icon: UserCircle }
    ]
  }
];

export function PanelProductorLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useLogout();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const { conteos, marcarSeccionComoLeida } = useNotificacionesPorSeccion('PRODUCTOR');

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
          <span className="font-bold text-aut-verde text-lg">AUT Compras</span>
        </div>

        <div className="px-3 pt-3 shrink-0">
          <NavLink
            to="/productor/pedir"
            onClick={() => setSidebarAbierto(false)}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full bg-aut-verde text-white text-sm font-semibold hover:bg-aut-verde/90 transition-colors"
          >
            <PlusCircle size={18} />
            Hacer un pedido
          </NavLink>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-3 mb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => {
                      setSidebarAbierto(false);
                      if (conteos[to] > 0) marcarSeccionComoLeida(to);
                    }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-aut-verde/10 text-aut-verde' : 'text-gray-600 hover:bg-gray-100'
                      }`
                    }
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="flex-1">{label}</span>
                    {conteos[to] > 0 && (
                      <span className="bg-aut-naranja text-white text-xs rounded-full min-w-5 h-5 px-1 flex items-center justify-center shrink-0">
                        {conteos[to] > 9 ? '9+' : conteos[to]}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
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
