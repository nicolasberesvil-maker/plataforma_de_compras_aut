# Fase 0 — Setup Inicial

> **Sprint:** Pre-fase (1-2 días)
> **Objetivo:** Dejar el repo inicializado, las dependencias instaladas y la BD conectada, listo para que la Fase 1 arranque sin fricción.

---

## Resultado esperado

Al terminar esta fase debe ser posible ejecutar:

```bash
cd backend && npm run dev    # backend levanta en puerto 4000
cd frontend && npm run dev   # frontend levanta en puerto 5173
```

Y conectarse a `http://localhost:5173` para ver la página de inicio (aunque sea vacía).

---

## Tareas

### 1. Inicializar el repo

```bash
mkdir plataformadecompras
cd plataformadecompras
git init
```

Crear `.gitignore` raíz:

```
node_modules/
dist/
build/
.env
.env.local
.env.production
*.log
.DS_Store
.vscode/
.idea/
coverage/
```

Crear `README.md` raíz (usar el que viene en este repo de docs).

### 2. Crear estructura de carpetas

```
plataformadecompras/
├── backend/
├── frontend/
├── docs/                # los .md de especificación
├── README.md
├── AGENT-INSTRUCTIONS.md
└── CONVENCIONES.md
```

### 3. Inicializar Backend

```bash
cd backend
npm init -y
```

#### Dependencias

```bash
# Runtime
npm install express cors helmet morgan dotenv \
  bcrypt jsonwebtoken cookie-parser \
  zod prisma @prisma/client \
  nodemailer socket.io \
  pino pino-pretty \
  node-cron express-rate-limit

# Dev
npm install -D nodemon jest supertest @types/jest \
  eslint prettier eslint-config-prettier
```

#### Scripts en `package.json`

```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "test": "jest --runInBand",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:seed": "node prisma/seed.js"
  }
}
```

#### Configurar Prisma

```bash
npx prisma init --datasource-provider mysql
```

Esto crea `prisma/schema.prisma`. **Por ahora dejarlo vacío** (solo con generator y datasource). El schema completo se va construyendo fase por fase.

#### Crear estructura de carpetas backend

```bash
mkdir -p src/config src/middlewares src/modules src/services src/jobs src/utils
mkdir -p tests/integration tests/fixtures
```

#### Archivo `src/config/env.js`

```javascript
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().url(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
```

**Por qué Zod valida `.env`**: si arranca el server con un secret de 4 caracteres, te enterás al levantar, no en producción cuando explote la autenticación.

#### Archivo `src/config/database.js`

```javascript
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error']
});
```

#### Archivo `src/utils/logger.js`

```javascript
import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined
});
```

#### Archivo `src/utils/errors.js`

```javascript
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, details) { super(message, 400, 'VALIDATION_ERROR', details); }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado') { super(message, 401, 'UNAUTHORIZED'); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Sin permisos') { super(message, 403, 'FORBIDDEN'); }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso') { super(`${resource} no encontrado`, 404, 'NOT_FOUND'); }
}

export class ConflictError extends AppError {
  constructor(message, details) { super(message, 409, 'CONFLICT', details); }
}
```

#### Archivo `src/middlewares/error.middleware.js`

```javascript
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  // Errores de Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: {
        code: 'UNIQUE_CONSTRAINT',
        message: 'Ya existe un registro con esos datos',
        details: err.meta
      }
    });
  }

  // Error no controlado
  logger.error({ err, path: req.path, method: req.method }, 'Error no controlado');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor'
    }
  });
}
```

#### Archivo `src/middlewares/validate.middleware.js`

```javascript
import { ValidationError } from '../utils/errors.js';

/**
 * Valida req.body, req.query o req.params usando un schema de Zod.
 * @param {ZodSchema} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new ValidationError('Datos inválidos', result.error.format()));
    }
    req[source] = result.data;
    next();
  };
}
```

#### Archivo `src/app.js`

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { logger } from './utils/logger.js';

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
```

#### Archivo `src/server.js`

```javascript
import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
// import { socketService } from './services/socket.service.js';
// import { iniciarJobs } from './jobs/index.js';

const httpServer = http.createServer(app);

// socketService.iniciar(httpServer);  // se activa en Fase 5 cuando empiezan notif
// iniciarJobs();                       // se activa en Fase 4 con cron de campañas

httpServer.listen(env.PORT, () => {
  logger.info(`Backend escuchando en puerto ${env.PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido, cerrando servidor');
  httpServer.close(() => process.exit(0));
});
```

#### Archivo `.env.example`

```env
NODE_ENV=development
PORT=4000

DATABASE_URL="mysql://root:password@localhost:3306/plataformadecompras"

JWT_ACCESS_SECRET=cambiar-este-secret-de-al-menos-32-caracteres
JWT_REFRESH_SECRET=otro-secret-distinto-de-al-menos-32-caracteres
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:5173

SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=
SMTP_FROM=no-reply@aut.com.ar
SMTP_SECURE=false
```

Copiar a `.env` y completar valores reales.

---

### 4. Inicializar Frontend

```bash
cd ../
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

#### Dependencias adicionales

```bash
npm install react-router-dom \
  @tanstack/react-query \
  zustand \
  axios \
  socket.io-client \
  zod \
  react-hook-form @hookform/resolvers \
  date-fns \
  lucide-react

# Dev
npm install -D tailwindcss postcss autoprefixer \
  @vitejs/plugin-react \
  vitest @testing-library/react @testing-library/jest-dom \
  eslint prettier eslint-plugin-react eslint-plugin-react-hooks
```

#### Configurar Tailwind

```bash
npx tailwindcss init -p
```

`tailwind.config.js`:

```javascript
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'aut-verde': '#1d9e75',
        'aut-naranja': '#d85a30'
      }
    }
  },
  plugins: []
};
```

`src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

#### Crear estructura de carpetas frontend

```bash
mkdir -p src/api src/components/ui src/components/layout \
  src/features src/hooks src/layouts src/pages src/routes src/store src/utils
```

#### Archivo `src/api/client.js`

```javascript
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}/api`,
  withCredentials: true
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // TODO: en Fase 1 implementar refresh automático cuando hay 401
    return Promise.reject(error);
  }
);
```

#### Archivo `src/store/authStore.js` (stub)

```javascript
import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  accessToken: null,
  usuario: null,
  setAuth: (accessToken, usuario) => set({ accessToken, usuario }),
  logout: () => set({ accessToken: null, usuario: null })
}));
```

#### Archivo `src/App.jsx`

```jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

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
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

#### Archivo `.env.example`

```env
VITE_BACKEND_URL=http://localhost:4000
```

---

### 5. Crear base de datos local

```bash
# Asumiendo MySQL local
mysql -u root -p
CREATE DATABASE plataformadecompras;
EXIT;
```

Actualizar `DATABASE_URL` en `.env` del backend.

---

### 6. Verificación final

```bash
# Backend
cd backend
npm run dev
# Debe mostrar: "Backend escuchando en puerto 4000"
# Probar: curl http://localhost:4000/health → debe responder OK

# Frontend
cd ../frontend
npm run dev
# Debe levantar en http://localhost:5173
# Abrir en navegador → debe verse "Setup completo. Listo para Fase 1."
```

---

## Checklist de cierre de Fase 0

- [ ] `git init` ejecutado y primer commit hecho con la estructura.
- [ ] Backend levanta sin errores en puerto 4000.
- [ ] Endpoint `/health` responde correctamente.
- [ ] Frontend levanta sin errores en puerto 5173.
- [ ] La página inicial se muestra correctamente.
- [ ] `.env.example` presente en backend y frontend; `.env` ignorado por git.
- [ ] Prisma inicializado (aunque schema esté vacío).
- [ ] Base de datos `plataformadecompras` creada en MySQL local.
- [ ] `npm run lint` corre sin errores críticos en ambos proyectos.
- [ ] Tag git: `v0.0-setup-completo`.

---

## Próximo paso

Pasar a [`06-FASE-1-AUTH.md`](./06-FASE-1-AUTH.md).
