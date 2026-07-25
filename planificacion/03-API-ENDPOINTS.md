# 03 — Contrato API REST

> Listado completo de endpoints. Cada fase implementa los endpoints de su sección.
> Formato: `MÉTODO /ruta` — Roles permitidos — Descripción

---

## Convenciones generales

### Base URL

```
/api
```

### Headers obligatorios en endpoints autenticados

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Códigos de estado HTTP

| Código | Cuándo |
|--------|--------|
| 200 | OK — operación exitosa, retorna datos |
| 201 | Created — recurso creado |
| 204 | No Content — operación exitosa sin retorno |
| 400 | Bad Request — validación falló |
| 401 | Unauthorized — falta token o expiró |
| 403 | Forbidden — token válido pero sin permisos |
| 404 | Not Found — recurso no existe |
| 409 | Conflict — violación de regla de negocio (ej: transición de estado inválida) |
| 422 | Unprocessable Entity — datos válidos pero negocio rechaza |
| 429 | Too Many Requests — rate limit |
| 500 | Internal Server Error — error no controlado |

### Estructura de respuesta de error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El volumen mínimo debe ser positivo",
    "details": {
      "campo": "volumenMinimo",
      "valor": -100
    }
  }
}
```

### Paginación

Todos los endpoints de listado aceptan:

```
GET /api/<recurso>?page=1&limit=20&sort=createdAt&order=desc
```

Respuesta paginada:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

---

## Módulo: Autenticación

Base: `/api/auth`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/register` | Público | Auto-registro de productor (queda pendiente de aprobación) |
| POST | `/login` | Público | Login con email + password → access + refresh token |
| POST | `/refresh` | Público (con refresh cookie) | Renueva access token |
| POST | `/logout` | Autenticado | Revoca refresh token |
| POST | `/forgot-password` | Público | Solicita link de recuperación por email |
| POST | `/reset-password` | Público (con token) | Cambia password con token |
| GET | `/me` | Autenticado | Datos del usuario logueado |

### Body de `/register`

```json
{
  "email": "productor@ejemplo.com",
  "password": "secreto123",
  "nombre": "Juan",
  "apellido": "Pérez",
  "telefono": "+543492123456",
  "razonSocial": "Juan Pérez SA",
  "cuit": "20123456789",
  "condicionFiscal": "RESPONSABLE_INSCRIPTO",
  "domicilioFiscal": "Av. Belgrano 1450",
  "localidad": "Franck"
}
```

### Body de `/login`

```json
{
  "email": "productor@ejemplo.com",
  "password": "secreto123"
}
```

### Response de `/login`

```json
{
  "accessToken": "eyJhbGc...",
  "usuario": {
    "id": 42,
    "email": "productor@ejemplo.com",
    "nombre": "Juan",
    "rol": "PRODUCTOR"
  }
}
```

El refresh token va en httpOnly cookie.

---

## Módulo: Usuarios

Base: `/api/usuarios`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/` | ADMIN | Listar todos los usuarios (paginado, con filtros) |
| GET | `/:id` | ADMIN, mismo usuario | Detalle de usuario |
| PATCH | `/:id` | ADMIN, mismo usuario | Actualizar datos personales |
| PATCH | `/:id/activar` | ADMIN | Activar usuario |
| PATCH | `/:id/desactivar` | ADMIN | Desactivar usuario |
| POST | `/:id/cambiar-password` | Mismo usuario | Cambio voluntario de password |

### Query params en GET `/`

```
?rol=PRODUCTOR&activo=true&search=juan
```

---

## Módulo: Productores

Base: `/api/productores`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/` | ADMIN, CONTADOR | Listar productores |
| GET | `/:id` | ADMIN, CONTADOR, mismo productor | Detalle del productor |
| PATCH | `/:id` | ADMIN, mismo productor | Actualizar datos fiscales |
| PATCH | `/:id/aprobar` | ADMIN | Aprobar productor pendiente |
| PATCH | `/:id/rechazar` | ADMIN | Rechazar productor pendiente |
| GET | `/pendientes` | ADMIN | Productores pendientes de aprobación |

---

## Módulo: Proveedores

Base: `/api/proveedores`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/` | ADMIN, CONTADOR | Listar proveedores |
| POST | `/` | ADMIN | Alta manual de proveedor |
| GET | `/:id` | ADMIN, CONTADOR, mismo proveedor | Detalle |
| PATCH | `/:id` | ADMIN | Actualizar datos |
| PATCH | `/:id/aprobar` | ADMIN | Aprobar proveedor |
| PATCH | `/:id/suspender` | ADMIN | Suspender proveedor |
| GET | `/:id/ranking` | ADMIN | Stats del proveedor (volumen, mejor precio histórico) |

---

## Módulo: Productos (catálogo)

Base: `/api/productos`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/` | Autenticado | Listar productos activos |
| GET | `/:id` | Autenticado | Detalle |
| POST | `/` | ADMIN | Crear producto |
| PATCH | `/:id` | ADMIN | Editar producto |
| DELETE | `/:id` | ADMIN | Desactivar (no borra, marca activo=false) |

### Query params

```
?categoria=AGROQUIMICO&activo=true&search=glifo
```

---

## Módulo: Campañas

Base: `/api/campanas`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/` | Autenticado | Listar campañas (filtros por estado, producto) |
| GET | `/:id` | Autenticado | Detalle de campaña |
| GET | `/:id/resumen` | Autenticado | Vista pública de la campaña (volumen acumulado, # productores, sin nombres) |
| POST | `/` | ADMIN, OPERADOR | Crear campaña (queda en BORRADOR) |
| PATCH | `/:id` | ADMIN, OPERADOR | Editar campaña (solo si está en BORRADOR) |
| PATCH | `/:id/abrir` | ADMIN, OPERADOR | Transición BORRADOR → ABIERTA |
| PATCH | `/:id/cerrar-intenciones` | ADMIN, OPERADOR | Transición ABIERTA → EN_LICITACION |
| PATCH | `/:id/cancelar` | ADMIN | Cancelar campaña |
| GET | `/:id/intenciones` | ADMIN, OPERADOR, CONTADOR | Listar intenciones de la campaña (vista admin con nombres) |
| GET | `/:id/cotizaciones` | ADMIN, CONTADOR | Listar cotizaciones recibidas |

### Body de POST `/`

```json
{
  "productoId": 12,
  "nombre": "Glifosato 48% - Octubre 2026",
  "descripcion": "Campaña para siembra de soja",
  "volumenMinimo": 5000,
  "volumenMaximo": 50000,
  "fechaApertura": "2026-09-01T00:00:00Z",
  "fechaCierre": "2026-09-30T23:59:59Z",
  "fechaCierreCotizaciones": "2026-10-07T23:59:59Z",
  "horasLockoutEdicion": 24
}
```

### Response de `/:id/resumen` (vista pública)

```json
{
  "id": 42,
  "nombre": "Glifosato 48% - Octubre 2026",
  "estado": "ABIERTA",
  "volumenAcumulado": 14500,
  "volumenMinimo": 5000,
  "cantidadProductores": 28,
  "fechaCierre": "2026-09-30T23:59:59Z",
  "minIntencionPropia": {
    "volumen": 500,
    "modalidadEntregaPreferida": "RETIRO_EN_DEPOSITO",
    "depositoPreferidoId": 2
  }
}
```

Si el usuario es productor, se incluye su propia intención (`miIntencionPropia`). Si no cargó nada, viene `null`.

---

## Módulo: Intenciones de Compra

Base: `/api/intenciones`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/` | PRODUCTOR | Cargar intención (vinculada a campaña) |
| GET | `/mias` | PRODUCTOR | Listar intenciones propias |
| GET | `/:id` | PRODUCTOR (owner), ADMIN | Detalle |
| PUT | `/:id` | PRODUCTOR (owner) | Actualizar intención (solo si campaña ABIERTA y antes del lockout) |
| DELETE | `/:id` | PRODUCTOR (owner) | Eliminar intención |

### Body de POST `/`

```json
{
  "campanaId": 42,
  "volumen": 500,
  "observaciones": "Para los lotes del este",
  "modalidadEntregaPreferida": "RETIRO_EN_DEPOSITO",
  "depositoPreferidoId": 2
}
```

---

## Módulo: Cotizaciones

Base: `/api/cotizaciones`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/mias` | PROVEEDOR | Listar cotizaciones propias |
| GET | `/campanas-abiertas` | PROVEEDOR | Listar campañas en EN_LICITACION para cotizar |
| GET | `/:id` | PROVEEDOR (owner), ADMIN | Detalle |
| POST | `/` | PROVEEDOR | Crear cotización para una campaña |
| PUT | `/:id` | PROVEEDOR (owner) | Editar cotización (mientras la campaña esté en licitación) |
| DELETE | `/:id` | PROVEEDOR (owner) | Retirar cotización |

### Body de POST `/`

```json
{
  "campanaId": 42,
  "precioUnitario": 1850.50,
  "monedaPrecio": "ARS",
  "plazoEntregaDias": 15,
  "condicionesPago": "30 días contra factura. Sin anticipo.",
  "observaciones": "Stock disponible inmediato",
  "validaHasta": "2026-10-15T23:59:59Z"
}
```

---

## Módulo: Adjudicaciones

Base: `/api/adjudicaciones`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/` | ADMIN, CONTADOR | Listar adjudicaciones históricas |
| GET | `/:id` | ADMIN, CONTADOR | Detalle |
| POST | `/` | ADMIN | Adjudicar campaña (elegir ganador y generar órdenes) |
| GET | `/campana/:campanaId/comparador` | ADMIN | Comparador de cotizaciones para decidir |

### Body de POST `/` (adjudicar)

```json
{
  "campanaId": 42,
  "cotizacionGanadoraId": 18,
  "precioMinoristaReferencia": 2300,
  "motivoEleccion": "Mejor precio + plazo de entrega de 7 días"
}
```

Esta operación genera, en una transacción:
- El registro de `Adjudicacion`.
- Una `OrdenCompra` por cada productor con intención válida.
- Una `Entrega` (en estado PENDIENTE) por cada orden.
- Eventos `CAMPANA_ADJUDICADA`, `ORDEN_GENERADA` (uno por productor), `COTIZACION_ADJUDICADA` (para el proveedor ganador), `COTIZACION_RECHAZADA` (para los demás).

---

## Módulo: Órdenes de Compra

Base: `/api/ordenes`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/mias` | PRODUCTOR | Mis órdenes de compra |
| GET | `/` | ADMIN, CONTADOR | Listar todas las órdenes |
| GET | `/:id` | PRODUCTOR (owner), ADMIN, CONTADOR | Detalle |
| PATCH | `/:id/forma-pago` | ADMIN, PRODUCTOR (owner) | Definir forma de pago y cuotas |
| PATCH | `/:id/marcar-pagada` | ADMIN, CONTADOR | Confirmar cobro |

---

## Módulo: Depósitos

Base: `/api/depositos`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/` | Autenticado | Listar depósitos activos |
| GET | `/:id` | Autenticado | Detalle del depósito |
| POST | `/` | ADMIN | Crear depósito |
| PATCH | `/:id` | ADMIN | Editar |
| PATCH | `/:id/desactivar` | ADMIN | Desactivar (soft delete) |
| GET | `/:id/stock` | ADMIN, CONTADOR, OPERADOR_DEPOSITO (su depósito) | Stock actual por producto |
| GET | `/:id/movimientos` | ADMIN, CONTADOR, OPERADOR_DEPOSITO | Historial de movimientos |

### Body de POST `/`

```json
{
  "nombre": "Galpón Franck",
  "localidad": "Franck",
  "direccion": "Av. Belgrano 1450",
  "responsable": "Juan Pérez",
  "telefonoContacto": "+543492123456",
  "horarioAtencion": "Lunes a viernes 8 a 17 hs",
  "capacidadMaxima": 100000
}
```

### Response de `/:id/stock`

```json
{
  "deposito": {
    "id": 1,
    "nombre": "Galpón Franck",
    "localidad": "Franck"
  },
  "stockPorProducto": [
    {
      "productoId": 12,
      "nombreProducto": "Glifosato 48%",
      "unidadMedida": "LITRO",
      "stockActual": 4200,
      "stockReservado": 1500,
      "stockDisponible": 2700
    }
  ]
}
```

---

## Módulo: Stock (movimientos)

Base: `/api/stock-movimientos`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/` | ADMIN, CONTADOR, OPERADOR_DEPOSITO | Historial filtrable |
| POST | `/ingreso` | ADMIN, OPERADOR_DEPOSITO | Registrar ingreso de mercadería (proveedor entregó) |
| POST | `/ajuste` | ADMIN | Ajuste por conteo físico |
| POST | `/transferencia` | ADMIN | Transferencia entre depósitos (genera 2 movimientos: salida + entrada) |

### Body de POST `/ingreso`

```json
{
  "depositoId": 1,
  "productoId": 12,
  "cantidad": 5000,
  "proveedorOrigen": "Glifosato SA",
  "observaciones": "Llegada de adjudicación campaña 42"
}
```

### Body de POST `/ajuste`

```json
{
  "depositoId": 1,
  "productoId": 12,
  "diferencia": -50,
  "observaciones": "Conteo físico del 15/10. Diferencia por rotura de 1 bidón."
}
```

---

## Módulo: Entregas

Base: `/api/entregas`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/mias` | PRODUCTOR | Mis entregas pendientes/activas |
| GET | `/` | ADMIN, OPERADOR_DEPOSITO | Listar entregas (filtros por depósito, estado) |
| GET | `/:id` | PRODUCTOR (owner), ADMIN | Detalle |
| PATCH | `/:id/en-transito` | ADMIN | Marcar EN_TRANSITO |
| PATCH | `/:id/disponible` | ADMIN, OPERADOR_DEPOSITO | Marcar DISPONIBLE_PARA_RETIRO (genera notificación al productor) |
| PATCH | `/:id/confirmar-retiro` | ADMIN, OPERADOR_DEPOSITO | Confirmar retiro (genera movimiento de egreso automático) |
| PATCH | `/:id/confirmar-entrega-campo` | ADMIN | Confirmar entrega en campo |
| PATCH | `/:id/cancelar` | ADMIN | Cancelar entrega |

### Body de PATCH `/:id/confirmar-retiro`

```json
{
  "recibidaPorNombre": "Juan Pérez",
  "recibidaPorDni": "12345678",
  "observaciones": "Retiró todo el volumen"
}
```

---

## Módulo: Facturas

Base: `/api/facturas`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/mias` | PRODUCTOR | Mis facturas |
| GET | `/` | ADMIN, CONTADOR | Listar todas |
| GET | `/:id` | PRODUCTOR (owner), ADMIN, CONTADOR | Detalle |
| GET | `/:id/pdf` | PRODUCTOR (owner), ADMIN, CONTADOR | Descargar PDF |
| POST | `/generar/:ordenCompraId` | ADMIN, CONTADOR | Generar factura para una orden |

---

## Módulo: Notificaciones

Base: `/api/notificaciones`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/` | Autenticado | Listar notificaciones del usuario |
| GET | `/no-leidas/count` | Autenticado | Cantidad de no leídas (badge campanita) |
| PATCH | `/:id/leer` | Autenticado (owner) | Marcar como leída |
| PATCH | `/leer-todas` | Autenticado | Marcar todas como leídas |
| DELETE | `/:id` | Autenticado (owner) | Eliminar notificación |

### Query params

```
?leida=false&tipo=CAMPANA_ABIERTA&page=1&limit=20
```

---

## Módulo: Dashboard

Base: `/api/dashboard`

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/kpis` | ADMIN, CONTADOR | KPIs principales |
| GET | `/ahorro-acumulado` | ADMIN, CONTADOR | Ahorro generado a productores (pesos + %) |
| GET | `/volumen-por-insumo` | ADMIN, CONTADOR | Volumen transaccionado agrupado |
| GET | `/tasa-adopcion` | ADMIN | Productores activos vs total |
| GET | `/balance-iva` | ADMIN, CONTADOR | IVA crédito vs débito |
| GET | `/ranking-proveedores` | ADMIN, CONTADOR | Top proveedores |
| GET | `/top-productores` | ADMIN | Top compradores |
| GET | `/formas-pago-frecuentes` | ADMIN, CONTADOR | Forma de pago más adoptada |
| GET | `/export/excel` | ADMIN, CONTADOR | Exportar reporte completo a Excel |

### Query params globales

```
?desde=2026-01-01&hasta=2026-12-31&productoId=12
```

---

## WebSocket Events (Socket.io)

Conexión: `/socket.io` con token JWT como query param o header.

### Eventos emitidos por el servidor → cliente

| Evento | Payload | Quién lo recibe |
|--------|---------|------------------|
| `notificacion:nueva` | `{ id, tipo, titulo, mensaje, enlace }` | Usuario destinatario |
| `campana:actualizada` | `{ campanaId, volumenAcumulado, cantidadProductores }` | Productores y admins |
| `cotizacion:nueva` | `{ campanaId, totalCotizaciones }` | Admins (no proveedores) |

### Eventos del cliente → servidor

| Evento | Payload | Acción |
|--------|---------|--------|
| `subscribe:campana` | `{ campanaId }` | Se suscribe a actualizaciones de una campaña |
| `unsubscribe:campana` | `{ campanaId }` | Cancela suscripción |

---

## Resumen de endpoints por fase

| Fase | Endpoints implementados |
|------|--------------------------|
| 1 — Auth | Todos los de `/auth` |
| 2 — Usuarios | `/usuarios`, `/productores`, `/proveedores` |
| 3 — Productos | `/productos` |
| 4 — Campañas | `/campanas` (CRUD + estados) |
| 5 — Intenciones | `/intenciones`, `/campanas/:id/intenciones`, `/campanas/:id/resumen` |
| 6 — Cotizaciones | `/cotizaciones` |
| 7 — Adjudicación | `/adjudicaciones`, `/ordenes` |
| 8 — Depósitos y Stock | `/depositos`, `/stock-movimientos` |
| 9 — Entregas | `/entregas` |
| 10 — Facturación | `/facturas` |
| 11 — Dashboard | `/dashboard` |
| Transversal | `/notificaciones` + WebSockets (se va alimentando en cada fase) |
