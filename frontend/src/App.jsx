import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/pages/LoginPage';
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/pages/ResetPasswordPage';
import { UsuariosListPage } from './features/usuarios/pages/UsuariosListPage';
import { ProductoresPage } from './features/usuarios/pages/ProductoresPage';
import { ProveedoresPage } from './features/usuarios/pages/ProveedoresPage';
import { ProveedorDetailPage } from './features/usuarios/pages/ProveedorDetailPage';
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
import { CampanasParaCotizarPage } from './features/cotizaciones/pages/CampanasParaCotizarPage';
import { CotizacionFormPage } from './features/cotizaciones/pages/CotizacionFormPage';
import { CotizacionDetailPage } from './features/cotizaciones/pages/CotizacionDetailPage';
import { MisCotizacionesPage } from './features/cotizaciones/pages/MisCotizacionesPage';
import { ComparadorPage } from './features/adjudicaciones/pages/ComparadorPage';
import { MisOrdenesPage } from './features/ordenes/pages/MisOrdenesPage';
import { MisVentasPage } from './features/ordenes/pages/MisVentasPage';
import { MiCuentaProveedorPage } from './features/usuarios/pages/MiCuentaProveedorPage';
import { DepositosListPage } from './features/depositos/pages/DepositosListPage';
import { DepositoFormPage } from './features/depositos/pages/DepositoFormPage';
import { DepositoDetailPage } from './features/depositos/pages/DepositoDetailPage';
import { MovimientosStockPage } from './features/depositos/pages/MovimientosStockPage';
import { StockPage } from './features/depositos/pages/StockPage';
import { EntregasAdminPage } from './features/entregas/pages/EntregasAdminPage';
import { EntregaDetailPage } from './features/entregas/pages/EntregaDetailPage';
import { MisEntregasPage } from './features/entregas/pages/MisEntregasPage';
import { FacturasAdminPage } from './features/facturas/pages/FacturasAdminPage';
import { FacturaDetailPage } from './features/facturas/pages/FacturaDetailPage';
import { MisFacturasPage } from './features/facturas/pages/MisFacturasPage';
import { PagosAdminPage } from './features/pagos/pages/PagosAdminPage';
import { MiCuentaPage } from './features/pagos/pages/MiCuentaPage';
import { DashboardAdminPage } from './features/dashboard/pages/DashboardAdminPage';
import { DashboardProductorPage } from './features/dashboard/pages/DashboardProductorPage';
import { PanelAdminLayout } from './layouts/PanelAdminLayout';
import { PanelProductorLayout } from './layouts/PanelProductorLayout';
import { PanelProveedorLayout } from './layouts/PanelProveedorLayout';
import { PanelDepositoLayout } from './layouts/PanelDepositoLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { useAuthStore } from './store/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false }
  }
});

const RUTA_POR_ROL = {
  ADMIN: '/admin',
  PRODUCTOR: '/productor',
  PROVEEDOR: '/proveedor',
  OPERADOR_DEPOSITO: '/deposito'
};

function RaizRedirect() {
  const { accessToken, usuario } = useAuthStore();
  if (!accessToken || !usuario) return <Navigate to="/login" replace />;
  return <Navigate to={RUTA_POR_ROL[usuario.rol] ?? '/login'} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RaizRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/perfil" element={<ProtectedRoute><MiPerfilPage /></ProtectedRoute>} />

          <Route
            path="/admin"
            element={<ProtectedRoute roles={['ADMIN']}><PanelAdminLayout /></ProtectedRoute>}
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardAdminPage />} />
            <Route path="usuarios" element={<UsuariosListPage />} />
            <Route path="productores" element={<ProductoresPage />} />
            <Route path="proveedores" element={<ProveedoresPage />} />
            <Route path="proveedores/:id" element={<ProveedorDetailPage />} />
            <Route path="productos" element={<ProductosListPage />} />
            <Route path="productos/nuevo" element={<ProductoFormPage />} />
            <Route path="productos/:id/editar" element={<ProductoFormPage />} />
            <Route path="campanas" element={<CampanasListPage />} />
            <Route path="campanas/nueva" element={<CampanaFormPage />} />
            <Route path="campanas/:id" element={<CampanaDetailPage />} />
            <Route path="campanas/:id/editar" element={<CampanaFormPage />} />
            <Route path="campanas/:id/comparador" element={<ComparadorPage />} />
            <Route path="solicitudes" element={<BandejaPedidosPage />} />
            <Route path="stock" element={<StockPage />} />
            <Route path="depositos" element={<DepositosListPage />} />
            <Route path="depositos/nuevo" element={<DepositoFormPage />} />
            <Route path="depositos/:id" element={<DepositoDetailPage />} />
            <Route path="depositos/:id/editar" element={<DepositoFormPage />} />
            <Route path="movimientos-stock" element={<MovimientosStockPage />} />
            <Route path="entregas" element={<EntregasAdminPage />} />
            <Route path="entregas/:id" element={<EntregaDetailPage />} />
            <Route path="facturas" element={<FacturasAdminPage />} />
            <Route path="facturas/:id" element={<FacturaDetailPage />} />
            <Route path="pagos" element={<PagosAdminPage />} />
          </Route>

          <Route
            path="/productor"
            element={<ProtectedRoute roles={['PRODUCTOR']}><PanelProductorLayout /></ProtectedRoute>}
          >
            <Route index element={<CampanasAbiertasPage />} />
            <Route path="resumen" element={<DashboardProductorPage />} />
            <Route path="pedir" element={<PedirProductoPage />} />
            <Route path="mis-pedidos" element={<MisPedidosPage />} />
            <Route path="mis-ordenes" element={<MisOrdenesPage />} />
            <Route path="mis-entregas" element={<MisEntregasPage />} />
            <Route path="entregas/:id" element={<EntregaDetailPage />} />
            <Route path="mis-facturas" element={<MisFacturasPage />} />
            <Route path="facturas/:id" element={<FacturaDetailPage />} />
            <Route path="mi-cuenta" element={<MiCuentaPage />} />
            <Route path="campanas/:id" element={<CampanaProductorDetailPage />} />
          </Route>

          <Route
            path="/deposito"
            element={<ProtectedRoute roles={['OPERADOR_DEPOSITO']}><PanelDepositoLayout /></ProtectedRoute>}
          >
            <Route index element={<EntregasAdminPage />} />
            <Route path="entregas/:id" element={<EntregaDetailPage />} />
          </Route>

          <Route
            path="/proveedor"
            element={<ProtectedRoute roles={['PROVEEDOR']}><PanelProveedorLayout /></ProtectedRoute>}
          >
            <Route index element={<CampanasParaCotizarPage />} />
            <Route path="campanas/:id/cotizar" element={<CotizacionFormPage />} />
            <Route path="cotizaciones/:id" element={<CotizacionDetailPage />} />
            <Route path="mis-cotizaciones" element={<MisCotizacionesPage />} />
            <Route path="mis-ventas" element={<MisVentasPage />} />
            <Route path="mi-cuenta" element={<MiCuentaProveedorPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
