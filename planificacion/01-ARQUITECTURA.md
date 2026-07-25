# 01 — Arquitectura Técnica

> Stack, capas, decisiones técnicas y la justificación de cada una. Si el agente no entiende **por qué** se eligió cada pieza, va a tomar atajos que rompen el sistema.

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| Frontend | React + Vite + TailwindCSS | React 18+, Vite 5+ |
| Routing | React Router | v6+ |
| Estado servidor | TanStack Query (React Query) | v5+ |
| Estado UI | Zustand | v4+ |
| Backend | Node.js + Express | Node 20 LTS, Express 4 |
| Base de datos | MySQL | 8.0+ |
| ORM | Prisma | 5+ |
| Validación | Zod | 3+ |
| Auth | jsonwebtoken + bcrypt | última estable |
| Notificaciones email | Nodemailer | última estable |
| Notificaciones in-app | Socket.io | 4+ |
| Logger | Pino | última estable |
| Testing backend | Jest + Supertest | última estable |
| Testing frontend | Vitest + React Testing Library | última estable |
| Cron jobs | node-cron | última estable |

### Justificación de cada elección crítica

**¿Por qué MySQL y no MongoDB?**
El dominio es altamente relacional: campañas → intenciones → cotizaciones → adjudicación → órdenes → facturas, todo con integridad referencial estricta. Además, las operaciones fiscales (IVA crédito/débito, percepciones IIBB, retenciones RG 830) exigen **transacciones ACID** — si una transacción falla a mitad de proceso, todo debe revertirse. MySQL garantiza esto nativamente; MongoDB exige más esfuerzo para conseguir lo mismo.

**¿Por qué Prisma y no Sequelize?**
- Mejor DX (autocompletado type-safe).
- Migraciones más robustas y versionadas.
- Queries más declarativas y legibles.
- Tiene transacciones de primera clase con `prisma.$transaction()`.

**¿Por qué React + Vite y no Next.js?**
v1 es una **SPA con auth**, no un sitio público con SEO. Vite es más liviano, más rápido en desarrollo y no agrega complejidad de SSR que no necesitamos. Si en v2 sumamos páginas públicas (landing, marketplace), evaluamos migrar.

**¿Por qué TailwindCSS?**
- Mobile-first nativo (clave para el productor que entra del celular).
- Sin archivos CSS sueltos que se desordenan.
- Acelera la consistencia visual.
- Curva de aprendizaje aceptable para devs junior.

**¿Por qué Zustand + TanStack Query y no Redux?**
Redux es overkill para v1. La separación correcta es:
- **Estado del servidor** (campañas, intenciones, cotizaciones): TanStack Query maneja caché, refetch, optimistic updates.
- **Estado UI local** (modal abierto, form en progreso): useState.
- **Estado global del cliente** (usuario logueado, tema): Zustand.

Esto evita el "todo es Redux" que termina siendo un anti-pattern.

**¿Por qué Socket.io para notificaciones in-app?**
La UX requiere notificaciones en tiempo real ("campanita" se actualiza apenas se abre una campaña). HTTP polling sería ineficiente y consumiría datos del celular del productor (importante: zona rural con conexión limitada).

---

## Arquitectura por capas

El sistema se organiza en **4 capas con responsabilidades estrictas**:

```
┌─────────────────────────────────────────────────────┐
│  CAPA 1: PRESENTACIÓN (Frontend React)              │
│  - Portal Productor (mobile-first)                  │
│  - Portal Proveedor                                 │
│  - Panel Admin (AUT)                                │
│  - PWA responsive                                   │
└─────────────────────────────────────────────────────┘
                       │ HTTP/WS
                       ▼
┌─────────────────────────────────────────────────────┐
│  CAPA 2: API (Express + Socket.io)                  │
│  - Routes                                           │
│  - Middlewares (auth, validación, rate-limit)       │
│  - Sin lógica de negocio                            │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  CAPA 3: DOMINIO (Services)                         │
│  - Reglas de negocio                                │
│  - Máquinas de estado                               │
│  - Coordinación entre módulos                       │
│  - No conoce HTTP                                   │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  CAPA 4: DATOS (Prisma + MySQL)                     │
│  - Acceso a la BD                                   │
│  - Transacciones ACID                               │
│  - Migraciones versionadas                          │
└─────────────────────────────────────────────────────┘
```

### Por qué arquitectura por capas

Como el sistema tiene implicancias fiscales (cada acción puede generar IVA, débitos, créditos), necesitamos **separación de responsabilidades estricta**:

- **Si cambia AFIP** (de v1 a v2): solo se toca `FacturacionService`. La UI ni se entera.
- **Si cambia la UI** (nuevo diseño): no afecta la lógica de negocio.
- **Si cambiamos de MySQL a PostgreSQL**: solo cambia el `schema.prisma`. Los services siguen igual.
- **Testabilidad**: los services se testean sin BD ni HTTP.

---

## Estructura modular por dominio

Tanto backend como frontend se organizan por **vertical slicing**: cada dominio del negocio es un módulo autocontenido.

### Backend: módulos

```
backend/src/modules/
├── auth/              # Login, registro, refresh tokens
├── usuarios/          # CRUD de usuarios (transversal)
├── productores/       # Datos específicos de productores
├── proveedores/       # Datos específicos de proveedores
├── productos/         # Catálogo de insumos
├── campanas/          # Campañas de compra + estados
├── intenciones/       # Intenciones de compra de productores
├── cotizaciones/      # Cotizaciones de proveedores
├── adjudicaciones/    # Elección de ganador
├── ordenes/           # Órdenes de compra individuales
├── depositos/         # Galpones físicos de AUT
├── stock/             # Libro de movimientos de stock
├── entregas/          # Logística (retiro o entrega en campo)
├── facturas/          # Comprobantes (internos en v1)
├── notificaciones/    # Centro de notificaciones del usuario
└── dashboard/         # KPIs y reportes
```

### Frontend: features

```
frontend/src/features/
├── auth/              # Login, registro, recuperar password
├── campanas/          # Listado, detalle, creación
├── intenciones/       # Mis intenciones, formulario
├── cotizaciones/      # Mis cotizaciones (proveedor)
├── adjudicaciones/    # Comparador (admin)
├── depositos/         # Gestión de depósitos
├── stock/             # Tablero de stock por depósito
├── entregas/          # Estado de entregas
├── facturas/          # Mis facturas
├── notificaciones/    # Campanita + listado
└── dashboard/         # KPIs (admin)
```

---

## Patrón Controller / Service / Repository

Cada módulo backend sigue esta estructura interna:

```
modules/<dominio>/
├── <dominio>.controller.js   # Capa HTTP — extrae req, llama service, devuelve res
├── <dominio>.service.js      # Lógica de negocio — pura, testeable
├── <dominio>.routes.js       # Define las rutas y middlewares
├── <dominio>.schemas.js      # Validación Zod
└── <dominio>.test.js         # Tests del service
```

### Ejemplo conceptual

```javascript
// campanas.controller.js — capa HTTP
export async function crearCampana(req, res, next) {
  try {
    const datos = req.body; // ya validado por middleware Zod
    const campana = await campanaService.crear(datos, req.usuario);
    res.status(201).json(campana);
  } catch (err) {
    next(err); // error handler centralizado lo procesa
  }
}

// campanas.service.js — lógica de negocio
export async function crear(datos, usuario) {
  // 1. Reglas de negocio
  if (datos.volumenMinimo <= 0) {
    throw new ValidationError('El volumen mínimo debe ser positivo');
  }
  if (new Date(datos.fechaCierre) <= new Date()) {
    throw new ValidationError('La fecha de cierre debe ser futura');
  }

  // 2. Persistencia (puede usar Prisma directamente o un repository)
  const campana = await prisma.campana.create({
    data: {
      ...datos,
      estado: 'BORRADOR',
      creadaPorId: usuario.id
    }
  });

  // 3. Eventos (notificaciones, integraciones)
  eventBus.emit('CAMPANA_CREADA', { campanaId: campana.id });

  return campana;
}
```

### Por qué este patrón

- **El controller es delgado**: no contiene lógica, solo orquesta.
- **El service es testeable**: se prueba sin Express, sin HTTP, sin nada.
- **El repository (opcional para v1)**: si en algún módulo la lógica de acceso a datos se complica, se extrae a un archivo aparte.

---

## Máquinas de estado

Varias entidades del sistema tienen ciclo de vida controlado. **No se permiten transiciones arbitrarias** — toda transición se valida en el service.

### Estados de una Campaña

```
BORRADOR → ABIERTA → EN_LICITACION → ADJUDICADA → CERRADA
                ↓           ↓             
            CANCELADA   CANCELADA       
```

### Estados de una Entrega

```
PENDIENTE → EN_TRANSITO → DISPONIBLE_PARA_RETIRO → ENTREGADA
                                              
                ↓                                
            CANCELADA                            
```

### Implementación

Cada módulo con máquina de estado tiene un util:

```javascript
// utils/transiciones-campana.js
export const TRANSICIONES_CAMPANA = {
  BORRADOR:       ['ABIERTA', 'CANCELADA'],
  ABIERTA:        ['EN_LICITACION', 'CANCELADA'],
  EN_LICITACION:  ['ADJUDICADA', 'CANCELADA'],
  ADJUDICADA:     ['CERRADA'],
  CERRADA:        [],
  CANCELADA:      []
};

export function puedeTransicionar(estadoActual, estadoNuevo) {
  return TRANSICIONES_CAMPANA[estadoActual]?.includes(estadoNuevo) ?? false;
}
```

El service lo usa:

```javascript
if (!puedeTransicionar(campana.estado, 'EN_LICITACION')) {
  throw new ConflictError(`No se puede pasar de ${campana.estado} a EN_LICITACION`);
}
```

---

## Sistema de eventos (Event Bus)

Para desacoplar la lógica de negocio de los efectos colaterales (notificaciones, integraciones), usamos un **Event Bus en memoria** basado en el `EventEmitter` nativo de Node.

### Flujo

```
CampanaService.abrir()
    ↓
eventBus.emit('CAMPANA_ABIERTA', { campanaId })
    ↓
    ├─→ NotificacionService.notificarProductores()
    │       ├─→ EmailService.enviar()
    │       ├─→ SocketService.emitir()
    │       └─→ NotificacionRepo.crear()
    └─→ AuditoriaService.registrar()
```

### Ventajas

- El service de campañas no sabe que existen notificaciones.
- Mañana podemos agregar un listener nuevo (ej. "registrar en blockchain") sin tocar el service.
- Cada listener se testea aislado.

---

## Seguridad

### Autenticación

- **JWT** firmado con HS256 (secret en `.env`).
- **Access token** de 15 min, en memoria del frontend (NO localStorage).
- **Refresh token** de 7 días, en httpOnly cookie segura.
- **bcrypt** con cost factor 12 para passwords.

### Autorización

- Middleware `requireRole(['ADMIN'])` por endpoint.
- Service valida ownership: un productor solo puede editar SUS intenciones.

### Otros controles

- **Rate limiting** en login y registro (`express-rate-limit`).
- **Helmet** para headers HTTP.
- **CORS** con whitelist explícita.
- **Validación con Zod** en TODA entrada del cliente.
- **Variables sensibles** solo en `.env`.

---

## Notificaciones

Dos canales en paralelo:

1. **Email (Nodemailer + SMTP)**: para eventos importantes.
2. **In-app via Socket.io**: campanita en tiempo real.

Todas las notificaciones quedan **persistidas en BD** (tabla `Notificacion`) para que el productor las vea aunque haya estado offline.

Detalles completos: ver [`04-NOTIFICACIONES.md`](./04-NOTIFICACIONES.md).

---

## Logging

- **Pino** para logs estructurados (JSON).
- Niveles: `fatal`, `error`, `warn`, `info`, `debug`.
- En producción se exporta a un servicio externo (ej. Logtail, Datadog en v2).
- Cada request tiene un `requestId` único para tracing.

---

## Jobs programados

Cron jobs ejecutados con `node-cron`:

| Job | Frecuencia | Acción |
|-----|------------|--------|
| Cierre automático de campañas | Cada hora | Cambia campañas vencidas de ABIERTA a EN_LICITACION |
| Recordatorio 48 hs antes del cierre | Diario 9:00 | Notifica a productores que no cargaron intención |
| Limpieza de refresh tokens vencidos | Diario 3:00 | Borra registros expirados |

---

## Deploy

### v1 (objetivo siembra maíz 2026)

| Componente | Servicio |
|------------|----------|
| Frontend | Vercel |
| Backend | Railway o Render |
| MySQL | Railway o PlanetScale |
| SMTP | Resend o SendGrid (free tier) |

### v2 (escala)

Migración eventual a AWS:
- ECS Fargate para backend.
- RDS para MySQL.
- S3 para archivos (facturas en PDF).
- CloudFront para frontend.

---

## Decisiones que NO se tomaron (y por qué)

| Decisión rechazada | Por qué |
|---------------------|---------|
| TypeScript en v1 | Tiempo de aprendizaje del equipo. Migramos en v1.5 con `// @ts-check` progresivo. |
| Microservicios | Overkill para 50 usuarios activos. Monolito modular es lo correcto. |
| GraphQL | El cliente es interno y conocido. REST alcanza. |
| Docker en v1 | Suma complejidad operativa. Se incorpora en Fase 12. |
| Redis | No hay caso de uso claro todavía. Se evalúa si aparece bottleneck. |
| Kafka / RabbitMQ | EventEmitter en memoria es suficiente para v1. |

Estas decisiones se reevalúan en v2.
