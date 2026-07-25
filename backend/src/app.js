import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/error.middleware.js';

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

// TODO: aquí van los routers de cada módulo (los va a sumar cada fase)
// import authRoutes from './modules/auth/auth.routes.js';
// app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint no encontrado' } });
});

// Error handler (siempre último)
app.use(errorHandler);

export default app;
