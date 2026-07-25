# Fase 1 — Autenticación y Autorización

> **Sprint:** 1 (1 semana)
> **Objetivo:** Sistema de login funcional con JWT, refresh tokens, roles, y middleware de autorización.

---

## Resultado esperado

Al terminar esta fase debe ser posible:
- Registrar un productor desde la UI (queda como pendiente de aprobación).
- Loguearse y recibir un access token + refresh token.
- Renovar el access token cuando expire.
- Cerrar sesión (revoca refresh token).
- Endpoints protegidos rechazan requests sin token o con rol incorrecto.

---

## Prerrequisitos

- Fase 0 completada (setup levanta correctamente).
- Tag `v0.0-setup-completo` aplicado.

---

## Tareas

### 1. Schema Prisma — Usuarios, Productores, Proveedores, RefreshTokens

Editar `backend/prisma/schema.prisma` y agregar los modelos `Usuario`, `Productor`, `Proveedor`, `RefreshToken` con sus enums (ver `docs/02-MODELO-DATOS.md` — solo los modelos de esta fase).

Ejecutar:

```bash
npx prisma migrate dev --name init_auth
```

### 2. Módulo `auth`

Crear estructura:

```
backend/src/modules/auth/
├── auth.controller.js
├── auth.service.js
├── auth.routes.js
├── auth.schemas.js
└── auth.test.js
```

#### `auth.schemas.js`

```javascript
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  nombre: z.string().min(2).max(50),
  apellido: z.string().min(2).max(50),
  telefono: z.string().optional(),
  // Datos de productor
  razonSocial: z.string().min(2),
  cuit: z.string().regex(/^\d{11}$/, 'CUIT debe tener 11 dígitos'),
  condicionFiscal: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'EXENTO', 'CONSUMIDOR_FINAL']),
  domicilioFiscal: z.string().min(5),
  localidad: z.string().min(2)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});
```

#### `auth.service.js`

```javascript
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { UnauthorizedError, ConflictError, NotFoundError } from '../../utils/errors.js';

const BCRYPT_COST = 12;

/**
 * Registra un productor nuevo. Queda inactivo hasta que AUT lo apruebe.
 * Crea Usuario + Productor en una transacción.
 */
export async function register(datos) {
  const existe = await prisma.usuario.findUnique({ where: { email: datos.email } });
  if (existe) throw new ConflictError('Ya existe un usuario con ese email');

  const passwordHash = await bcrypt.hash(datos.password, BCRYPT_COST);

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email: datos.email,
        passwordHash,
        rol: 'PRODUCTOR',
        activo: false, // queda inactivo hasta aprobación
        nombre: datos.nombre,
        apellido: datos.apellido,
        telefono: datos.telefono
      }
    });

    await tx.productor.create({
      data: {
        usuarioId: usuario.id,
        razonSocial: datos.razonSocial,
        cuit: datos.cuit,
        condicionFiscal: datos.condicionFiscal,
        domicilioFiscal: datos.domicilioFiscal,
        localidad: datos.localidad,
        aprobado: false
      }
    });

    return { id: usuario.id, email: usuario.email };
  });
}

/**
 * Login: valida credenciales, retorna access token + refresh token.
 */
export async function login(email, password) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) throw new UnauthorizedError('Credenciales inválidas');

  const passwordOk = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordOk) throw new UnauthorizedError('Credenciales inválidas');

  if (!usuario.activo) {
    throw new UnauthorizedError('Usuario inactivo. Esperá la aprobación de AUT.');
  }

  // Actualizar último login (no bloqueante)
  prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoLoginAt: new Date() }
  }).catch(() => {});

  const accessToken = generarAccessToken(usuario);
  const refreshToken = await generarRefreshToken(usuario.id);

  return {
    accessToken,
    refreshToken,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol
    }
  };
}

/**
 * Renueva el access token usando un refresh token válido.
 * Rota el refresh token (single-use).
 */
export async function refresh(refreshTokenPlano) {
  if (!refreshTokenPlano) throw new UnauthorizedError('Sin refresh token');

  const tokenHash = hashToken(refreshTokenPlano);
  const registro = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { usuario: true }
  });

  if (!registro) throw new UnauthorizedError('Refresh token inválido');
  if (registro.revocadoAt) throw new UnauthorizedError('Refresh token revocado');
  if (registro.expiraAt < new Date()) throw new UnauthorizedError('Refresh token expirado');

  // Rotar: revocar el actual y emitir uno nuevo
  await prisma.refreshToken.update({
    where: { id: registro.id },
    data: { revocadoAt: new Date() }
  });

  const accessToken = generarAccessToken(registro.usuario);
  const nuevoRefresh = await generarRefreshToken(registro.usuario.id);

  return { accessToken, refreshToken: nuevoRefresh };
}

/**
 * Logout: revoca el refresh token actual.
 */
export async function logout(refreshTokenPlano) {
  if (!refreshTokenPlano) return;
  const tokenHash = hashToken(refreshTokenPlano);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revocadoAt: null },
    data: { revocadoAt: new Date() }
  });
}

// ============================================================
// Helpers internos
// ============================================================

function generarAccessToken(usuario) {
  return jwt.sign(
    { usuarioId: usuario.id, rol: usuario.rol, email: usuario.email },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
}

async function generarRefreshToken(usuarioId) {
  // Token aleatorio (no JWT, no contiene info)
  const token = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashToken(token);
  const expiraAt = new Date();
  expiraAt.setDate(expiraAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: { usuarioId, tokenHash, expiraAt }
  });

  return token;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verifica un access token y retorna su payload.
 * Usado por el middleware de autenticación.
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}
```

#### `auth.controller.js`

```javascript
import * as authService from './auth.service.js';
import { env } from '../../config/env.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
};

export async function register(req, res, next) {
  try {
    const usuario = await authService.register(req.body);
    res.status(201).json({
      message: 'Registro exitoso. AUT revisará tu solicitud y te notificará por email.',
      usuario
    });
  } catch (err) { next(err); }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { accessToken, refreshToken, usuario } = await authService.login(email, password);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.json({ accessToken, usuario });
  } catch (err) { next(err); }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const result = await authService.refresh(refreshToken);

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    res.json({ accessToken: result.accessToken });
  } catch (err) { next(err); }
}

export async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    await authService.logout(refreshToken);
    res.clearCookie('refreshToken');
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function me(req, res) {
  res.json({ usuario: req.usuario });
}
```

#### `auth.routes.js`

```javascript
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from './auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { registerSchema, loginSchema } from './auth.schemas.js';

const router = Router();

// Rate limit estricto en endpoints sensibles
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Esperá 15 minutos.' } }
});

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
```

### 3. Middleware de autenticación y autorización

`backend/src/middlewares/auth.middleware.js`:

```javascript
import { verifyAccessToken } from '../modules/auth/auth.service.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

/**
 * Verifica el access token y carga req.usuario.
 * Si falla, responde 401.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Token requerido'));
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.usuario = {
      id: payload.usuarioId,
      rol: payload.rol,
      email: payload.email
    };
    next();
  } catch (err) {
    next(new UnauthorizedError('Token inválido o expirado'));
  }
}

/**
 * Verifica que el usuario tenga uno de los roles permitidos.
 * Uso: router.get('/x', authenticate, requireRole(['ADMIN']), handler)
 */
export function requireRole(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) return next(new UnauthorizedError());
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(new ForbiddenError(`Requiere rol: ${rolesPermitidos.join(' o ')}`));
    }
    next();
  };
}
```

### 4. Registrar rutas en `app.js`

```javascript
import authRoutes from './modules/auth/auth.routes.js';
app.use('/api/auth', authRoutes);
```

### 5. Frontend: feature auth

Estructura:

```
frontend/src/features/auth/
├── api/
│   └── auth.api.js
├── components/
│   ├── LoginForm.jsx
│   └── RegisterForm.jsx
├── pages/
│   ├── LoginPage.jsx
│   └── RegisterPage.jsx
└── hooks/
    └── useAuth.js
```

#### `api/auth.api.js`

```javascript
import { apiClient } from '../../../api/client';

export const authApi = {
  register: (datos) => apiClient.post('/auth/register', datos).then(r => r.data),
  login: (email, password) => apiClient.post('/auth/login', { email, password }).then(r => r.data),
  logout: () => apiClient.post('/auth/logout'),
  refresh: () => apiClient.post('/auth/refresh').then(r => r.data),
  me: () => apiClient.get('/auth/me').then(r => r.data)
};
```

#### `hooks/useAuth.js`

```javascript
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../../../store/authStore';

export function useLogin() {
  const setAuth = useAuthStore(s => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ email, password }) => authApi.login(email, password),
    onSuccess: (data) => {
      setAuth(data.accessToken, data.usuario);
      const ruta = data.usuario.rol === 'PRODUCTOR' ? '/productor' :
                   data.usuario.rol === 'PROVEEDOR' ? '/proveedor' : '/admin';
      navigate(ruta);
    }
  });
}

export function useLogout() {
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      logout();
      navigate('/login');
    }
  });
}
```

#### Actualizar `api/client.js` con auto-refresh

```javascript
let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        refreshPromise ??= apiClient.post('/auth/refresh').then(r => r.data);
        const { accessToken } = await refreshPromise;
        refreshPromise = null;

        useAuthStore.getState().setAuth(accessToken, useAuthStore.getState().usuario);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(original);
      } catch (refreshErr) {
        refreshPromise = null;
        useAuthStore.getState().logout();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);
```

#### Componente `LoginForm.jsx` (mobile-first)

```jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin } from '../hooks/useAuth';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Requerido')
});

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });
  const login = useLogin();

  return (
    <form onSubmit={handleSubmit((data) => login.mutate(data))}
          className="w-full max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold text-aut-verde">Ingresar</h1>

      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input {...register('email')} type="email" autoComplete="email"
               className="w-full px-3 py-3 border rounded-lg text-base" />
        {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Contraseña</label>
        <input {...register('password')} type="password" autoComplete="current-password"
               className="w-full px-3 py-3 border rounded-lg text-base" />
        {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
      </div>

      {login.isError && (
        <div className="text-red-600 text-sm">
          {login.error.response?.data?.error?.message || 'Error al ingresar'}
        </div>
      )}

      <button type="submit" disabled={login.isPending}
              className="w-full bg-aut-verde text-white py-3 rounded-lg font-medium disabled:opacity-50">
        {login.isPending ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>
  );
}
```

**Inputs grandes (py-3, text-base) porque el productor usa el celular en el campo, no con precisión de mouse.**

### 6. Tests

`auth.test.js` debe cubrir:
- Registro exitoso.
- Registro con email duplicado → 409.
- Login con credenciales correctas → 200 + tokens.
- Login con password incorrecto → 401.
- Login con usuario inactivo → 401 con mensaje claro.
- Refresh con token válido → nuevo access.
- Refresh con token revocado → 401.
- Endpoint protegido sin token → 401.
- Endpoint protegido con rol incorrecto → 403.

---

## Checklist de cierre

- [ ] Migración Prisma aplicada (`init_auth`).
- [ ] Endpoints `/api/auth/*` funcionando.
- [ ] Frontend tiene página de login y registro operativa.
- [ ] Auto-refresh de token funciona (probarlo bajando el `JWT_ACCESS_EXPIRES_IN` a `30s` temporalmente).
- [ ] Tests con coverage ≥ 60% en módulo auth.
- [ ] Tag: `v0.1-fase-1-auth`.

---

## Próximo paso

[`07-FASE-2-USUARIOS.md`](./07-FASE-2-USUARIOS.md)
