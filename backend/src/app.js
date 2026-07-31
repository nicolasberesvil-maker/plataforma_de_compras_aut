import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/error.middleware.js';
import authRoutes from './modules/auth/auth.routes.js';
import usuariosRoutes from './modules/usuarios/usuarios.routes.js';
import productoresRoutes from './modules/productores/productores.routes.js';
import proveedoresRoutes from './modules/proveedores/proveedores.routes.js';
import productosRoutes from './modules/productos/productos.routes.js';
import campanasRoutes from './modules/campanas/campanas.routes.js';
import intencionesRoutes from './modules/intenciones/intenciones.routes.js';
import cotizacionesRoutes from './modules/cotizaciones/cotizaciones.routes.js';
import notificacionesRoutes from './modules/notificaciones/notificaciones.routes.js';
import adjudicacionesRoutes from './modules/adjudicaciones/adjudicaciones.routes.js';
import ordenesRoutes from './modules/ordenes/ordenes.routes.js';
import depositosRoutes from './modules/depositos/depositos.routes.js';
import stockRoutes from './modules/stock/stock.routes.js';
import entregasRoutes from './modules/entregas/entregas.routes.js';
import facturasRoutes from './modules/facturas/facturas.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';

const app = express();

// Seguridad
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true
}));

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/productores', productoresRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/campanas', campanasRoutes);
app.use('/api/intenciones', intencionesRoutes);
app.use('/api/cotizaciones', cotizacionesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/adjudicaciones', adjudicacionesRoutes);
app.use('/api/ordenes', ordenesRoutes);
app.use('/api/depositos', depositosRoutes);
app.use('/api/stock-movimientos', stockRoutes);
app.use('/api/entregas', entregasRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/dashboard', dashboardRoutes);

// TODO: aquí van los routers del resto de módulos (los va a sumar cada fase)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint no encontrado' } });
});

// Error handler (siempre último)
app.use(errorHandler);

export default app;
