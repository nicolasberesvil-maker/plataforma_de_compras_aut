# Convenciones del Proyecto

> Reglas de naming, estructura y estilo para mantener consistencia en todo el código.

---

## Naming

### Backend

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Carpetas | kebab-case | `modules/stock-movimientos/` |
| Archivos JS | kebab-case | `campana.controller.js`, `auth.service.js` |
| Variables y funciones | camelCase | `obtenerCampanaPorId`, `volumenTotal` |
| Clases | PascalCase | `CampanaService`, `NotFoundError` |
| Constantes globales | UPPER_SNAKE_CASE | `MAX_VOLUMEN_CAMPANA`, `JWT_SECRET` |
| Variables de entorno | UPPER_SNAKE_CASE | `DATABASE_URL`, `SMTP_HOST` |
| Tablas (Prisma) | PascalCase singular | `Campana`, `IntencionCompra` |
| Columnas (DB) | snake_case | `volumen_minimo`, `created_at` |
| Enums | UPPER_SNAKE_CASE | `ABIERTA`, `EN_LICITACION` |

### Frontend

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Carpetas | kebab-case | `features/campanas/` |
| Componentes | PascalCase | `CampanaCard.jsx`, `IntencionForm.jsx` |
| Hooks | camelCase con prefijo `use` | `useCampana.js`, `useNotificaciones.js` |
| Utilidades | camelCase | `formatearVolumen.js`, `calcularAhorro.js` |
| Páginas (rutas) | PascalCase con sufijo `Page` | `CampanasListPage.jsx` |

### Endpoints REST

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Recursos en plural, en español | `/api/<recurso>` | `/api/campanas`, `/api/productores` |
| ID en la URL | `/api/<recurso>/:id` | `/api/campanas/42` |
| Sub-recursos | `/api/<recurso>/:id/<sub>` | `/api/campanas/42/intenciones` |
| Acciones que no son CRUD | verbo al final con PATCH | `/api/campanas/42/abrir` |
| Query params en camelCase | `?estado=...&desde=...` | `/api/campanas?estado=ABIERTA&desdeFecha=2026-01-01` |

---

## Idioma

Decisión: **español para términos del dominio, inglés para términos técnicos**.

| ✅ Correcto | ❌ Incorrecto |
|-------------|---------------|
| `class CampanaService` | `class CampaignService` |
| `function createCampana()` | `function crearCampaign()` |
| `module campanas` | `module campaigns` |
| `controller`, `service`, `middleware` | `controlador`, `servicio`, `intermediario` |
| `const productor = ...` | `const producer = ...` |
| `const request = req` | `const peticion = req` |

**Razón**: la mitad del equipo lee/escribe inglés mejor para términos técnicos, pero las entidades del negocio (campaña, productor, cotización, adjudicación) son específicas del dominio cooperativo argentino y traducirlas pierde claridad.

---

## Estructura de carpetas

### Backend

```
backend/
├── prisma/
│   ├── schema.prisma           # Modelo único de toda la BD
│   ├── migrations/             # Versionado de la BD
│   └── seed.js                 # Datos de prueba
├── src/
│   ├── config/                 # Variables de entorno tipadas
│   │   ├── env.js
│   │   └── database.js
│   ├── middlewares/            # Middlewares transversales
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   ├── validate.middleware.js
│   │   └── rate-limit.middleware.js
│   ├── modules/                # Un módulo por dominio
│   │   ├── auth/
│   │   ├── usuarios/
│   │   ├── productores/
│   │   ├── proveedores/
│   │   ├── productos/
│   │   ├── campanas/
│   │   ├── intenciones/
│   │   ├── cotizaciones/
│   │   ├── adjudicaciones/
│   │   ├── ordenes/
│   │   ├── depositos/
│   │   ├── stock/
│   │   ├── entregas/
│   │   ├── facturas/
│   │   ├── notificaciones/
│   │   └── dashboard/
│   ├── services/               # Servicios transversales
│   │   ├── email.service.js
│   │   ├── socket.service.js
│   │   └── event-bus.service.js
│   ├── jobs/                   # Cron jobs (cierres automáticos)
│   │   └── cierre-campanas.job.js
│   ├── utils/                  # Helpers puros
│   │   ├── errors.js
│   │   ├── logger.js
│   │   └── transiciones-estado.js
│   ├── app.js                  # Configura Express (no escucha puerto)
│   └── server.js               # Levanta servidor + Socket.io
├── tests/
│   ├── integration/
│   └── fixtures/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

### Frontend

```
frontend/
├── public/
├── src/
│   ├── api/                    # Cliente HTTP global
│   │   ├── client.js           # Axios configurado con interceptors
│   │   └── endpoints.js        # URLs centralizadas
│   ├── components/             # UI reutilizable
│   │   ├── ui/                 # Button, Input, Card, Modal, etc.
│   │   └── layout/             # Header, Sidebar, Footer
│   ├── features/               # Un feature = un dominio
│   │   ├── auth/
│   │   ├── campanas/
│   │   ├── intenciones/
│   │   ├── cotizaciones/
│   │   ├── depositos/
│   │   ├── notificaciones/
│   │   └── dashboard/
│   ├── hooks/                  # Hooks transversales
│   │   ├── useAuth.js
│   │   ├── useSocket.js
│   │   └── useDebounce.js
│   ├── layouts/                # Layout por tipo de usuario
│   │   ├── PortalProductorLayout.jsx
│   │   ├── PortalProveedorLayout.jsx
│   │   └── PanelAdminLayout.jsx
│   ├── pages/                  # Rutas top-level (lazy-loaded)
│   ├── routes/                 # React Router config
│   │   └── AppRouter.jsx
│   ├── store/                  # Zustand stores
│   │   ├── authStore.js
│   │   └── notificacionesStore.js
│   ├── utils/                  # Helpers puros
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css               # Tailwind base
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

---

## Commits

Formato: [Conventional Commits](https://www.conventionalcommits.org/) en español.

```
<tipo>(<scope>): <descripción corta>

<cuerpo opcional explicando el porqué>
```

### Tipos válidos

| Tipo | Cuándo usarlo |
|------|---------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Cambios solo en documentación |
| `style` | Formato (sin cambio de lógica) |
| `refactor` | Cambio de código sin cambio de comportamiento |
| `test` | Agregar o corregir tests |
| `chore` | Tareas de mantenimiento (dependencias, build) |
| `perf` | Mejora de performance |

### Ejemplos

```bash
feat(auth): implementar login con JWT
fix(campanas): corregir validación de fecha de cierre
docs(api): documentar endpoint de adjudicación
refactor(intenciones): extraer cálculo de volumen a util
test(stock): cubrir caso de ajuste por conteo físico
chore(deps): actualizar prisma a 5.10
```

### Branches

- `main`: solo código deployado a producción.
- `develop`: integración de todas las fases completadas.
- `feature/fase-X-nombre`: trabajo de cada fase.
- `hotfix/descripcion`: correcciones urgentes en producción.

---

## Estilo de código

### Backend (JavaScript)

- **2 espacios** de indentación (no tabs).
- **Punto y coma obligatorio** al final de cada statement.
- **Comillas simples** para strings (`'hola'` no `"hola"`), salvo en JSX o cuando hay apóstrofes.
- **Funciones flecha** salvo cuando se necesita `this` o hoisting.
- **`const` por defecto**, `let` solo si reasignás, **nunca `var`**.
- **Async/await** siempre, no `.then()` encadenados (salvo casos puntuales en Promise.all).
- **Destructuring** cuando mejora legibilidad: `const { id, nombre } = campana;`

### Frontend (JSX)

- **Componentes funcionales** únicamente.
- **Props destructuradas** en la firma: `function CampanaCard({ campana, onEditar }) {...}`.
- **Un componente por archivo**, mismo nombre de archivo y componente.
- **Imports ordenados**: librerías externas → imports absolutos → relativos → estilos.

---

## ESLint y Prettier

Cada proyecto (backend y frontend) trae configurado:

- **ESLint** con reglas base de Airbnb (con excepciones documentadas).
- **Prettier** integrado con ESLint para auto-formato al guardar.
- **Husky** + **lint-staged** para correr lint y tests pre-commit.

Configuración base (backend):

```json
{
  "extends": ["eslint:recommended"],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "env": {
    "node": true,
    "es2022": true,
    "jest": true
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "warn",
    "semi": ["error", "always"],
    "quotes": ["error", "single", { "avoidEscape": true }]
  }
}
```

---

## Versionado

Seguimos **SemVer** (`MAJOR.MINOR.PATCH`):

- `MAJOR`: cambios incompatibles en la API pública.
- `MINOR`: nueva funcionalidad compatible.
- `PATCH`: bugfixes compatibles.

Cada fase completada genera un tag: `v0.1-fase-1-auth`, `v0.2-fase-2-usuarios`, etc.

La v1.0.0 sale cuando esté la Fase 12 completa y testeada con usuarios reales (target: siembra maíz 2026).
