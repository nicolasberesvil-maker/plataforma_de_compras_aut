import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/pages/LoginPage';
import { RegisterPage } from './features/auth/pages/RegisterPage';
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/pages/ResetPasswordPage';
import { UsuariosListPage } from './features/usuarios/pages/UsuariosListPage';
import { ProductoresPendientesPage } from './features/usuarios/pages/ProductoresPendientesPage';
import { ProveedoresPage } from './features/usuarios/pages/ProveedoresPage';
import { MiPerfilPage } from './features/perfil/pages/MiPerfilPage';
import { ProductosListPage } from './features/productos/pages/ProductosListPage';
import { ProductoFormPage } from './features/productos/pages/ProductoFormPage';
import { CampanasListPage } from './features/campanas/pages/CampanasListPage';
import { CampanaFormPage } from './features/campanas/pages/CampanaFormPage';
import { CampanaDetailPage } from './features/campanas/pages/CampanaDetailPage';
import { CampanasAbiertasPage } from './features/campanas/pages/CampanasAbiertasPage';
import { PedirProductoPage } from './features/intenciones/pages/PedirProductoPage';
import { MisPedidosPage } from './features/intenciones/pages/MisPedidosPage';
import { CampanaProductorDetailPage } from './features/intenciones/pages/CampanaProductorDetailPage';
import { BandejaPedidosPage } from './features/intenciones/pages/BandejaPedidosPage';
import { PanelAdminLayout } from './layouts/PanelAdminLayout';
import { PanelProductorLayout } from './layouts/PanelProductorLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false }
  }
});

function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-aut-verde">Plataforma de Compras AUT</h1>
        <p className="mt-2 text-gray-600">Setup completo. Listo para Fase 1.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/perfil" element={<ProtectedRoute><MiPerfilPage /></ProtectedRoute>} />

          <Route
            path="/admin"
            element={<ProtectedRoute roles={['ADMIN']}><PanelAdminLayout /></ProtectedRoute>}
          >
            <Route index element={<Navigate to="usuarios" replace />} />
            <Route path="usuarios" element={<UsuariosListPage />} />
            <Route path="productores-pendientes" element={<ProductoresPendientesPage />} />
            <Route path="proveedores" element={<ProveedoresPage />} />
            <Route path="productos" element={<ProductosListPage />} />
            <Route path="productos/nuevo" element={<ProductoFormPage />} />
            <Route path="productos/:id/editar" element={<ProductoFormPage />} />
            <Route path="campanas" element={<CampanasListPage />} />
            <Route path="campanas/nueva" element={<CampanaFormPage />} />
            <Route path="campanas/:id" element={<CampanaDetailPage />} />
            <Route path="campanas/:id/editar" element={<CampanaFormPage />} />
            <Route path="solicitudes" element={<BandejaPedidosPage />} />
          </Route>

          <Route
            path="/productor"
            element={<ProtectedRoute roles={['PRODUCTOR']}><PanelProductorLayout /></ProtectedRoute>}
          >
            <Route index element={<CampanasAbiertasPage />} />
            <Route path="pedir" element={<PedirProductoPage />} />
            <Route path="mis-pedidos" element={<MisPedidosPage />} />
            <Route path="campanas/:id" element={<CampanaProductorDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
