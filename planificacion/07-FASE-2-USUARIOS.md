# Fase 2 — Gestión de Usuarios, Productores y Proveedores

> **Sprint:** 2 (1 semana)
> **Objetivo:** CRUD completo de los tres tipos de usuario del sistema + flujo de aprobación por AUT.

---

## Resultado esperado

- ADMIN puede listar, ver, activar, desactivar usuarios.
- ADMIN aprueba o rechaza productores pendientes.
- ADMIN da de alta proveedores manualmente.
- Productor puede ver y editar sus propios datos fiscales.
- Proveedor puede ver y editar sus propios datos.

---

## Prerrequisitos

- Fase 1 completa. Auth funcionando.

---

## Tareas

### 1. Módulo `usuarios`

```
backend/src/modules/usuarios/
├── usuarios.controller.js
├── usuarios.service.js
├── usuarios.routes.js
├── usuarios.schemas.js
└── usuarios.test.js
```

#### `usuarios.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import bcrypt from 'bcrypt';

export async function listar({ rol, activo, search, page = 1, limit = 20 }) {
  const where = {};
  if (rol) where.rol = rol;
  if (activo !== undefined) where.activo = activo;
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { nombre: { contains: search } },
      { apellido: { contains: search } }
    ];
  }

  const [data, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      select: {
        id: true, email: true, nombre: true, apellido: true,
        telefono: true, rol: true, activo: true,
        createdAt: true, ultimoLoginAt: true
      },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.usuario.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id, usuarioSolicitante) {
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    include: { productor: true, proveedor: true }
  });
  if (!usuario) throw new NotFoundError('Usuario');

  // Validación de ownership: si no es admin, solo puede ver lo propio
  if (usuarioSolicitante.rol !== 'ADMIN' && usuarioSolicitante.id !== id) {
    throw new ForbiddenError('Solo podés ver tus propios datos');
  }

  const { passwordHash, ...resto } = usuario;
  return resto;
}

export async function actualizar(id, datos, usuarioSolicitante) {
  if (usuarioSolicitante.rol !== 'ADMIN' && usuarioSolicitante.id !== id) {
    throw new ForbiddenError();
  }

  // No permitir cambio de rol salvo admin
  if (datos.rol && usuarioSolicitante.rol !== 'ADMIN') {
    delete datos.rol;
  }

  return prisma.usuario.update({
    where: { id },
    data: {
      nombre: datos.nombre,
      apellido: datos.apellido,
      telefono: datos.telefono,
      ...(datos.rol && { rol: datos.rol })
    },
    select: { id: true, email: true, nombre: true, apellido: true, telefono: true, rol: true, activo: true }
  });
}

export async function cambiarEstado(id, activo) {
  return prisma.usuario.update({ where: { id }, data: { activo } });
}

export async function cambiarPassword(id, passwordActual, passwordNueva) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw new NotFoundError('Usuario');

  const ok = await bcrypt.compare(passwordActual, usuario.passwordHash);
  if (!ok) throw new ForbiddenError('Contraseña actual incorrecta');

  const passwordHash = await bcrypt.hash(passwordNueva, 12);
  await prisma.usuario.update({ where: { id }, data: { passwordHash } });
}
```

### 2. Módulo `productores`

```
backend/src/modules/productores/
├── productores.controller.js
├── productores.service.js
├── productores.routes.js
├── productores.schemas.js
└── productores.test.js
```

#### `productores.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';

export async function listar({ aprobado, search, page = 1, limit = 20 }) {
  const where = {};
  if (aprobado !== undefined) where.aprobado = aprobado;
  if (search) {
    where.OR = [
      { razonSocial: { contains: search } },
      { cuit: { contains: search } }
    ];
  }

  const [data, total] = await Promise.all([
    prisma.productor.findMany({
      where,
      include: { usuario: { select: { email: true, nombre: true, apellido: true, activo: true } } },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.productor.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function listarPendientes() {
  return prisma.productor.findMany({
    where: { aprobado: false },
    include: { usuario: { select: { email: true, nombre: true, apellido: true, telefono: true } } },
    orderBy: { createdAt: 'asc' }
  });
}

export async function listarAprobados() {
  return prisma.productor.findMany({
    where: { aprobado: true, usuario: { activo: true } },
    include: { usuario: true }
  });
}

export async function obtenerPorId(id) {
  const productor = await prisma.productor.findUnique({
    where: { id },
    include: { usuario: true }
  });
  if (!productor) throw new NotFoundError('Productor');
  return productor;
}

export async function aprobar(id) {
  const productor = await prisma.productor.findUnique({ where: { id }, include: { usuario: true } });
  if (!productor) throw new NotFoundError('Productor');
  if (productor.aprobado) throw new ConflictError('Productor ya aprobado');

  // Transacción: aprobar productor + activar usuario
  const resultado = await prisma.$transaction(async (tx) => {
    const p = await tx.productor.update({
      where: { id },
      data: { aprobado: true, aprobadoAt: new Date() }
    });
    await tx.usuario.update({
      where: { id: productor.usuarioId },
      data: { activo: true }
    });
    return p;
  });

  // Emitir evento para notificar al productor
  eventBus.emit('PRODUCTOR_APROBADO', {
    productorId: id,
    usuarioId: productor.usuarioId
  });

  return resultado;
}

export async function rechazar(id, motivo) {
  // En v1 no borramos: dejamos productor con aprobado=false e usuario inactivo
  // Se podría agregar campo motivoRechazo si se quiere historial
  const productor = await prisma.productor.findUnique({ where: { id } });
  if (!productor) throw new NotFoundError('Productor');

  await prisma.usuario.update({
    where: { id: productor.usuarioId },
    data: { activo: false }
  });

  // TODO: notificar al productor con motivo
}
```

### 3. Módulo `proveedores`

Similar a productores pero:
- Alta manual por ADMIN (no auto-registro).
- Estado de aprobación: PENDIENTE / APROBADO / RECHAZADO / SUSPENDIDO.
- Al crearse, se genera el usuario también (en una transacción).

#### `proveedores.service.js` (extracto clave: alta manual)

```javascript
export async function crear(datos) {
  // Validar email único
  const existe = await prisma.usuario.findUnique({ where: { email: datos.email } });
  if (existe) throw new ConflictError('Email ya en uso');

  // Password temporal generada
  const passwordTemporal = crypto.randomBytes(8).toString('hex');
  const passwordHash = await bcrypt.hash(passwordTemporal, 12);

  const resultado = await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email: datos.email,
        passwordHash,
        rol: 'PROVEEDOR',
        activo: true,
        nombre: datos.nombre,
        apellido: datos.apellido,
        telefono: datos.telefono
      }
    });

    const proveedor = await tx.proveedor.create({
      data: {
        usuarioId: usuario.id,
        razonSocial: datos.razonSocial,
        cuit: datos.cuit,
        condicionFiscal: datos.condicionFiscal,
        domicilioFiscal: datos.domicilioFiscal,
        estadoAprobacion: 'APROBADO' // Si lo crea admin, ya está aprobado
      }
    });

    return { usuario, proveedor, passwordTemporal };
  });

  // Enviar email al proveedor con sus credenciales
  // TODO en este sprint o uno posterior

  return resultado;
}
```

### 4. Frontend: pantallas admin

```
frontend/src/features/usuarios/
├── api/usuarios.api.js
├── pages/
│   ├── UsuariosListPage.jsx
│   ├── ProductoresPendientesPage.jsx
│   └── ProveedoresPage.jsx
└── components/
    ├── UsuarioRow.jsx
    ├── AprobarProductorModal.jsx
    └── NuevoProveedorForm.jsx
```

Las pantallas usan TanStack Query para listar y mutar. Tabla simple con filtros (rol, búsqueda) y acciones por fila.

### 5. Frontend: pantalla "mi perfil" para productor y proveedor

```
frontend/src/features/perfil/
└── pages/MiPerfilPage.jsx
```

Form pre-cargado con datos del usuario logueado (`/api/auth/me`), permite editar y cambiar password.

---

## Tests

Cubrir:
- Admin lista todos los usuarios; productor solo ve lo propio.
- Aprobación de productor: cambia `aprobado=true` y `usuario.activo=true`.
- Productor no aprobado no puede loguearse (ya validado en Fase 1).
- Cambio de password requiere password actual correcta.
- Alta de proveedor genera usuario activo con password temporal.

---

## Checklist de cierre

- [ ] Endpoints de `/api/usuarios`, `/api/productores`, `/api/proveedores` implementados.
- [ ] Listener `PRODUCTOR_APROBADO` registrado (aún sin notificación real hasta Fase 4).
- [ ] Frontend muestra panel admin con tabs (Usuarios, Productores pendientes, Proveedores).
- [ ] Tests con coverage ≥ 60%.
- [ ] Tag: `v0.2-fase-2-usuarios`.

---

## Próximo paso

[`08-FASE-3-PRODUCTOS.md`](./08-FASE-3-PRODUCTOS.md)
