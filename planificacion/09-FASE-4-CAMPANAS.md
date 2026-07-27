# Fase 4 — Compras (Campañas y otros tipos)

> **Sprint:** 4-5 (1.5 semanas)
> **Objetivo:** Núcleo del sistema. Gestión del "proceso de compra" con máquina de estados estricta **por tipo** + cron de cierre automático.

---

## Contexto de negocio: por qué la plataforma no es solo "campañas"

La plataforma nació para el caso insignia de AUT: **compra colectiva** (agrupar el volumen de muchos productores y licitar). Pero la realidad operativa de AUT incluye compras que **no** encajan en ese molde, y el sistema debe cubrirlas para no quedar a medias:

| Tipo | Cuándo se usa | ¿Volumen mínimo? | ¿Licitación? | ¿Cierra? |
|------|---------------|------------------|--------------|----------|
| **COLECTIVA** | Caso insignia. Se junta demanda de varios productores para un insumo y se licita entre proveedores. Ej: "Glifosato 48% - Octubre 2026". | Sí | Sí (EN_LICITACION) | Sí, por fecha |
| **DIRECTA** | Compra puntual/individual a un proveedor ya elegido, sin esperar juntar volumen ni licitar. Ej: un productor necesita 200 L ya, o AUT recompra un faltante. | No | No | Se adjudica al instante |
| **CONTINUA** | Proceso permanente por producto. Los productores se van sumando y AUT compra por **tandas** cuando conviene. Ej: "Balanceado — pedido permanente". | Opcional (por tanda) | Por tanda | No cierra; genera tandas |

**Dos formas de llegar a una `Campana` (regla D.1, detalle en Fase 5):**

- **Top-down:** el ADMIN arma el requerimiento por su cuenta (el flujo que documenta esta fase) y avisa a los productores para que se sumen.
- **Bottom-up:** un productor carga una `SolicitudCompra` suelta (sin campaña) pidiendo un producto; el ADMIN la ve en una bandeja de pendientes y, si decide avanzar, la **agrupa** junto con otras similares para crear la `Campana`. Esa operación (`POST /api/solicitudes/agrupar`, ver `10-FASE-5-INTENCIONES.md`) termina llamando a este mismo `campanaService.crear()` + `abrir()` — no duplica lógica, solo agrega el paso previo de recolectar solicitudes y convertirlas en `IntencionCompra`.

**Decisión de arquitectura (fundamento):** NO se crean entidades nuevas (`CompraDirecta`, `CompraContinua`). Se generaliza `Campana` con un campo discriminador `tipo`. Motivo: todo el flujo aguas abajo —intención, cotización, adjudicación, orden, entrega, factura— ya cuelga de `Campana`. Un discriminador reutiliza esa cañería; entidades paralelas obligarían a duplicarla o a volver polimórficas todas las FKs, con más superficie de bug y peor auditabilidad fiscal. La palabra "campaña" queda como el nombre técnico del proceso; de cara al usuario se muestra el tipo.

**CONTINUA — cómo funciona sin romper el modelo:** el proceso continuo es un "padre" siempre abierto que acumula intenciones. Cuando AUT decide comprar, dispara una **tanda**: se genera una campaña **hija** (COLECTIVA o DIRECTA) con las intenciones acumuladas, y esa hija sigue el flujo normal hasta adjudicar. Así `Adjudicacion` sigue siendo 1:1 con la tanda y no hay que relajar restricciones. El padre nunca se adjudica a sí mismo.

---

## Resultado esperado

- ADMIN crea procesos de compra de cualquier `tipo` (estado BORRADOR).
- Los transiciona según el tipo:
  - COLECTIVA: BORRADOR → ABIERTA → EN_LICITACION → ADJUDICADA → CERRADA.
  - DIRECTA: BORRADOR → (ABIERTA opcional) → ADJUDICADA → CERRADA.
  - CONTINUA: BORRADOR → ABIERTA → (genera tandas hijas) ; el padre no cierra por fecha.
- Transiciones inválidas devuelven 409 (validadas contra el mapa del tipo).
- Job de cron cierra automáticamente **solo** las COLECTIVA vencidas (ABIERTA → EN_LICITACION). DIRECTA y CONTINUA se saltan (no tienen fechaCierre).
- Job avisa 48 hs antes del cierre a productores sin intención cargada (solo COLECTIVA con fecha).
- Frontend muestra los procesos para todos los roles, con vistas distintas según rol y según tipo.

---

## Prerrequisitos

- Fase 3 completa.

---

## Tareas

### 1. Schema Prisma

Agregar modelo `Campana`, enum `EstadoCampana`, enum `TipoCompra` y un `IntencionCompra` **básico** (ver `02-MODELO-DATOS.md`, que es la fuente de verdad). Decisión clave (2026-07, confirmada con Nicolás): `IntencionCompra` es un solo modelo con `campanaId` **nullable**, no dos entidades separadas — así el productor emite la misma "intención de compra" tenga o no campaña encima. Ver nota #9 de `02-MODELO-DATOS.md`.

Detalle:

- `Campana.tipo TipoCompra @default(COLECTIVA)`.
- `Campana.volumenMinimo` y `Campana.fechaCierre` pasan a **nullable** (solo COLECTIVA los exige).
- Self-relation `campanaPadre` / `tandas` para las tandas de CONTINUA.
- `Campana.fechaEstimadaRecepcion` (nullable): la estimación temprana de cuándo llega el pedido, que el ADMIN comunica al abrir el requerimiento. Distinta de `Entrega.fechaEstimada` (Fase 9), que se calcula recién al adjudicar según el `plazoEntregaDias` del proveedor ganador.
- `IntencionCompra` se crea ya en esta fase (no en Fase 5) porque el service de campañas de abajo la usa directamente (`obtenerResumen`, volumen acumulado). Fase 4 solo necesita: `campanaId` (nullable), `productorId`, `productoId`, `volumen`, `observaciones`, `estado` (`EstadoIntencion`) y `@@unique([campanaId, productorId])`. Los campos de preferencia logística/pago del productor (`fechaDeseada`, `modalidadEntregaPreferida`, `direccionEntregaCampo`, `formaPagoPreferida`) también quedan en el modelo desde ahora (están en `02-MODELO-DATOS.md`), pero **no tienen CRUD propio hasta Fase 5** — hoy solo campanas.service.js los toca de forma indirecta (agregación de volumen).
- La FK de `IntencionCompra.depositoPreferidoId` hacia `Deposito` se agrega recién en la migración de Fase 8, cuando ese modelo exista.

Migrar:

```bash
npx prisma migrate dev --name add_campanas
```

### 2. Util de transiciones de estado (por tipo)

La máquina de estados **depende del tipo de compra**. No hay un único mapa: cada tipo define qué transiciones son válidas. Esto evita, por ejemplo, que una DIRECTA pase por EN_LICITACION (no licita) o que una CONTINUA se cierre por fecha.

`backend/src/utils/transiciones-campana.js`:

```javascript
/**
 * Mapa de transiciones válidas por TIPO de compra.
 * Si un estado origen no tiene transición a un estado destino para ese tipo,
 * la transición no se permite (el service lanza 409).
 */
export const TRANSICIONES_CAMPANA = {
  // Caso insignia: agrupa volumen y licita antes de adjudicar.
  COLECTIVA: {
    BORRADOR:       ['ABIERTA', 'CANCELADA'],
    ABIERTA:        ['EN_LICITACION', 'CANCELADA'],
    EN_LICITACION:  ['ADJUDICADA', 'CANCELADA'],
    ADJUDICADA:     ['CERRADA'],
    CERRADA:        [],
    CANCELADA:      []
  },
  // Compra puntual: proveedor y precio ya conocidos, se adjudica sin licitar.
  // Puede saltar ABIERTA (BORRADOR → ADJUDICADA) para el caso más rápido.
  DIRECTA: {
    BORRADOR:       ['ABIERTA', 'ADJUDICADA', 'CANCELADA'],
    ABIERTA:        ['ADJUDICADA', 'CANCELADA'],
    ADJUDICADA:     ['CERRADA'],
    CERRADA:        [],
    CANCELADA:      []
  },
  // Proceso permanente: no se cierra por fecha ni se adjudica a sí mismo;
  // genera tandas hijas. Solo se puede cancelar (dar de baja el proceso).
  CONTINUA: {
    BORRADOR:       ['ABIERTA', 'CANCELADA'],
    ABIERTA:        ['CANCELADA'],
    CERRADA:        [],
    CANCELADA:      []
  }
};

export function puedeTransicionar(tipo, estadoActual, estadoNuevo) {
  return TRANSICIONES_CAMPANA[tipo]?.[estadoActual]?.includes(estadoNuevo) ?? false;
}

export function transicionesDisponibles(tipo, estadoActual) {
  return TRANSICIONES_CAMPANA[tipo]?.[estadoActual] ?? [];
}
```

> Nota: `puedeTransicionar` ahora recibe el `tipo` como primer argumento. Todos los llamados en el service se actualizan en consecuencia.

### 3. Módulo `campanas`

```
backend/src/modules/campanas/
├── campanas.controller.js
├── campanas.service.js
├── campanas.routes.js
├── campanas.schemas.js
└── campanas.test.js
```

#### `campanas.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';
import { puedeTransicionar } from '../../utils/transiciones-campana.js';

export async function listar({ estado, productoId, page = 1, limit = 20 }) {
  const where = {};
  if (estado) where.estado = estado;
  if (productoId) where.productoId = productoId;

  const [data, total] = await Promise.all([
    prisma.campana.findMany({
      where,
      include: { producto: true },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { fechaCierre: 'desc' }
    }),
    prisma.campana.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id) {
  const campana = await prisma.campana.findUnique({
    where: { id },
    include: { producto: true, creadaPor: { select: { nombre: true, apellido: true } } }
  });
  if (!campana) throw new NotFoundError('Campaña');
  return campana;
}

/**
 * Vista resumida para mostrar al productor.
 * Incluye volumen acumulado y cantidad de productores, sin nombres (regla C.6).
 * Si el usuario es productor, incluye su propia intención.
 */
export async function obtenerResumen(id, usuario) {
  const campana = await obtenerPorId(id);

  const stats = await prisma.intencionCompra.aggregate({
    where: { campanaId: id },
    _sum: { volumen: true },
    _count: true
  });

  const resumen = {
    id: campana.id,
    nombre: campana.nombre,
    descripcion: campana.descripcion,
    estado: campana.estado,
    producto: campana.producto,
    volumenAcumulado: Number(stats._sum.volumen ?? 0),
    volumenMinimo: Number(campana.volumenMinimo),
    cantidadProductores: stats._count,
    fechaApertura: campana.fechaApertura,
    fechaCierre: campana.fechaCierre,
    horasLockoutEdicion: campana.horasLockoutEdicion
  };

  // Si el solicitante es productor, agregar su propia intención
  if (usuario.rol === 'PRODUCTOR') {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: usuario.id } });
    if (productor) {
      const miIntencion = await prisma.intencionCompra.findUnique({
        where: { campanaId_productorId: { campanaId: id, productorId: productor.id } }
      });
      resumen.miIntencionPropia = miIntencion;
    }
  }

  return resumen;
}

export async function crear(datos, usuario) {
  const tipo = datos.tipo ?? 'COLECTIVA';

  // Validaciones de negocio que dependen del tipo.
  // COLECTIVA es la más exigente: necesita volumen mínimo y ventana de cierre.
  if (tipo === 'COLECTIVA') {
    if (!datos.volumenMinimo || Number(datos.volumenMinimo) <= 0) {
      throw new ValidationError('Una compra COLECTIVA requiere volumen mínimo positivo');
    }
    if (!datos.fechaCierre) {
      throw new ValidationError('Una compra COLECTIVA requiere fecha de cierre');
    }
    if (new Date(datos.fechaCierre) <= new Date(datos.fechaApertura)) {
      throw new ValidationError('La fecha de cierre debe ser posterior a la de apertura');
    }
  }

  // CONTINUA no cierra por fecha: se ignora/anula fechaCierre si vino cargada.
  if (tipo === 'CONTINUA' && datos.fechaCierre) {
    datos.fechaCierre = null;
  }

  // Regla común: máximo ≥ mínimo cuando ambos existen.
  if (datos.volumenMaximo && datos.volumenMinimo && datos.volumenMaximo < datos.volumenMinimo) {
    throw new ValidationError('Volumen máximo debe ser ≥ volumen mínimo');
  }

  const campana = await prisma.campana.create({
    data: {
      ...datos,
      tipo,
      estado: 'BORRADOR',
      creadaPorId: usuario.id
    },
    include: { producto: true }
  });

  eventBus.emit('CAMPANA_CREADA', { campanaId: campana.id, tipo, creadoPorId: usuario.id });
  return campana;
}

export async function actualizar(id, datos) {
  const campana = await obtenerPorId(id);
  if (campana.estado !== 'BORRADOR') {
    throw new ConflictError('Solo se puede editar una campaña en BORRADOR');
  }
  return prisma.campana.update({ where: { id }, data: datos, include: { producto: true } });
}

/**
 * Transiciona BORRADOR → ABIERTA.
 * Dispara notificación masiva a productores aprobados.
 */
export async function abrir(id) {
  const campana = await obtenerPorId(id);
  if (!puedeTransicionar(campana.tipo, campana.estado, 'ABIERTA')) {
    throw new ConflictError(`No se puede pasar de ${campana.estado} a ABIERTA (tipo ${campana.tipo})`);
  }
  // La validación de fecha solo aplica cuando hay fechaCierre (COLECTIVA).
  if (campana.fechaCierre && new Date(campana.fechaCierre) <= new Date()) {
    throw new ValidationError('No se puede abrir: la fecha de cierre ya pasó');
  }

  const actualizada = await prisma.campana.update({
    where: { id },
    data: { estado: 'ABIERTA' }
  });

  eventBus.emit('CAMPANA_ABIERTA', {
    campanaId: id,
    productoId: campana.productoId
  });

  return actualizada;
}

/**
 * Transiciona ABIERTA → EN_LICITACION.
 * Se ejecuta manualmente por AUT o automáticamente por el cron al vencer fechaCierre.
 */
export async function cerrarIntenciones(id, { motivo } = {}) {
  const campana = await obtenerPorId(id);
  // Solo COLECTIVA licita. DIRECTA/CONTINUA no tienen este paso.
  if (!puedeTransicionar(campana.tipo, campana.estado, 'EN_LICITACION')) {
    throw new ConflictError(`No se puede pasar de ${campana.estado} a EN_LICITACION (tipo ${campana.tipo})`);
  }

  // Validar volumen mínimo
  const stats = await prisma.intencionCompra.aggregate({
    where: { campanaId: id },
    _sum: { volumen: true }
  });
  const volumenAcumulado = Number(stats._sum.volumen ?? 0);

  if (volumenAcumulado < Number(campana.volumenMinimo)) {
    // Decisión: AUT debe revisar manualmente. Se cierra igual pero queda flag.
    // En v1, dejamos transicionar igual y AUT decide adjudicar o cancelar.
    // En v2 se puede agregar campo `requiereDecisionManual`.
  }

  const actualizada = await prisma.campana.update({
    where: { id },
    data: { estado: 'EN_LICITACION' }
  });

  eventBus.emit('CAMPANA_CERRADA', { campanaId: id, motivo });
  eventBus.emit('RFQ_ABIERTO', { campanaId: id, volumenConsolidado: volumenAcumulado });

  return actualizada;
}

/**
 * DIRECTA: adjudica sin licitar. El proveedor y el precio ya los conoce AUT,
 * así que se saltea EN_LICITACION. Transiciona a ADJUDICADA y delega la
 * generación de la orden/entrega/factura al módulo de adjudicaciones (Fase 7),
 * que ya sabe hacer ese trabajo a partir del evento. Fase 4 solo gobierna el estado.
 *
 * @param {object} datos - { proveedorId, precioUnitario, moneda, plazoEntregaDias, condicionesPago }
 */
export async function adjudicarDirecta(id, datos, usuario) {
  const campana = await obtenerPorId(id);
  if (campana.tipo !== 'DIRECTA') {
    throw new ConflictError('adjudicarDirecta solo aplica a compras de tipo DIRECTA');
  }
  if (!puedeTransicionar(campana.tipo, campana.estado, 'ADJUDICADA')) {
    throw new ConflictError(`No se puede pasar de ${campana.estado} a ADJUDICADA (tipo DIRECTA)`);
  }

  const actualizada = await prisma.campana.update({
    where: { id },
    data: { estado: 'ADJUDICADA' }
  });

  // El módulo de adjudicaciones (Fase 7) escucha este evento y genera la
  // Adjudicacion + OrdenCompra + Entrega a partir de las intenciones cargadas.
  eventBus.emit('COMPRA_DIRECTA_ADJUDICADA', {
    campanaId: id,
    proveedorId: datos.proveedorId,
    precioUnitario: datos.precioUnitario,
    adjudicadaPorId: usuario.id
  });

  return actualizada;
}

/**
 * CONTINUA: dispara una "tanda". El proceso continuo (padre) no se adjudica a
 * sí mismo; en su lugar crea una campaña HIJA (COLECTIVA o DIRECTA según cómo
 * quiera comprar AUT esta vez) que arranca ya ABIERTA con las intenciones
 * acumuladas copiadas. Esa hija sigue el flujo normal hasta adjudicar.
 *
 * Ventaja de diseño: Adjudicacion sigue siendo 1:1 con la tanda hija; el padre
 * queda perpetuamente ABIERTO acumulando la próxima demanda.
 *
 * @param {object} opciones - { tipoTanda: 'COLECTIVA'|'DIRECTA', fechaCierre? }
 */
export async function generarTanda(id, opciones, usuario) {
  const padre = await obtenerPorId(id);
  if (padre.tipo !== 'CONTINUA') {
    throw new ConflictError('Solo un proceso CONTINUA puede generar tandas');
  }
  if (padre.estado !== 'ABIERTA') {
    throw new ConflictError('El proceso continuo debe estar ABIERTO para generar una tanda');
  }

  const tipoTanda = opciones.tipoTanda ?? 'COLECTIVA';

  // Se ejecuta en transacción: crear la hija y "mover" las intenciones vigentes.
  return prisma.$transaction(async (tx) => {
    const intenciones = await tx.intencionCompra.findMany({
      where: { campanaId: padre.id }
    });
    if (intenciones.length === 0) {
      throw new ValidationError('No hay intenciones acumuladas para armar la tanda');
    }

    const hija = await tx.campana.create({
      data: {
        productoId: padre.productoId,
        tipo: tipoTanda,
        nombre: `${padre.nombre} — Tanda ${new Date().toLocaleDateString('es-AR')}`,
        descripcion: padre.descripcion,
        volumenMinimo: tipoTanda === 'COLECTIVA' ? padre.volumenMinimo : null,
        fechaApertura: new Date(),
        fechaCierre: opciones.fechaCierre ?? null,
        estado: tipoTanda === 'COLECTIVA' ? 'EN_LICITACION' : 'BORRADOR',
        campanaPadreId: padre.id,
        creadaPorId: usuario.id
      }
    });

    // Se re-vinculan las intenciones acumuladas a la tanda hija.
    await tx.intencionCompra.updateMany({
      where: { campanaId: padre.id },
      data: { campanaId: hija.id }
    });

    eventBus.emit('TANDA_GENERADA', { padreId: padre.id, hijaId: hija.id, tipoTanda });
    return hija;
  });
}

export async function cancelar(id, motivo) {
  const campana = await obtenerPorId(id);
  if (campana.estado === 'CERRADA' || campana.estado === 'CANCELADA') {
    throw new ConflictError('La campaña ya está finalizada');
  }

  const actualizada = await prisma.campana.update({
    where: { id },
    data: {
      estado: 'CANCELADA',
      canceladaAt: new Date(),
      motivoCancelacion: motivo
    }
  });

  eventBus.emit('CAMPANA_CANCELADA', { campanaId: id, motivo });
  return actualizada;
}
```

#### `campanas.schemas.js`

```javascript
import { z } from 'zod';

// volumenMinimo y fechaCierre son opcionales a nivel schema porque DIRECTA y
// CONTINUA no los requieren. La obligatoriedad de COLECTIVA se valida en el
// service (crear), donde ya conocemos el tipo y las reglas de negocio.
export const crearCampanaSchema = z.object({
  productoId: z.number().int().positive(),
  tipo: z.enum(['COLECTIVA', 'DIRECTA', 'CONTINUA']).default('COLECTIVA'),
  nombre: z.string().min(3).max(150),
  descripcion: z.string().max(2000).optional(),
  volumenMinimo: z.number().positive().optional(),
  volumenMaximo: z.number().positive().optional(),
  fechaApertura: z.coerce.date(),
  fechaCierre: z.coerce.date().optional(),
  fechaCierreCotizaciones: z.coerce.date().optional(),
  // Estimación temprana de recepción, distinta de Entrega.fechaEstimada (post-adjudicación).
  fechaEstimadaRecepcion: z.coerce.date().optional(),
  horasLockoutEdicion: z.number().int().nonnegative().default(0)
});

export const actualizarCampanaSchema = crearCampanaSchema.partial();

export const cancelarCampanaSchema = z.object({
  motivo: z.string().min(5).max(500)
});

// Adjudicación directa (tipo DIRECTA): proveedor y precio ya conocidos.
export const adjudicarDirectaSchema = z.object({
  proveedorId: z.number().int().positive(),
  precioUnitario: z.number().positive(),
  moneda: z.enum(['ARS', 'USD']).default('ARS'),
  plazoEntregaDias: z.number().int().nonnegative(),
  condicionesPago: z.string().min(3).max(500)
});

// Disparo de tanda (tipo CONTINUA).
export const generarTandaSchema = z.object({
  tipoTanda: z.enum(['COLECTIVA', 'DIRECTA']).default('COLECTIVA'),
  fechaCierre: z.coerce.date().optional()
});
```

### 4. Cron jobs

`backend/src/jobs/campanas.job.js`:

```javascript
import cron from 'node-cron';
import { prisma } from '../config/database.js';
import * as campanaService from '../modules/campanas/campanas.service.js';
import { eventBus } from '../services/event-bus.service.js';
import { logger } from '../utils/logger.js';

/**
 * Cada hora: cierra campañas que ya vencieron su fechaCierre.
 */
export function iniciarJobCierreAutomatico() {
  cron.schedule('0 * * * *', async () => {
    logger.info('Job: cierre automático de campañas');

    // Solo COLECTIVA cierra por fecha. CONTINUA queda ABIERTA con fechaCierre
    // null (ya excluida por el filtro), y DIRECTA no pasa por ABIERTA con fecha.
    // Se explicita el tipo para dejar la intención clara.
    const vencidas = await prisma.campana.findMany({
      where: { tipo: 'COLECTIVA', estado: 'ABIERTA', fechaCierre: { lt: new Date() } }
    });

    for (const campana of vencidas) {
      try {
        await campanaService.cerrarIntenciones(campana.id, { motivo: 'Cierre automático por vencimiento' });
        logger.info({ campanaId: campana.id }, 'Campaña cerrada automáticamente');
      } catch (err) {
        logger.error({ err, campanaId: campana.id }, 'Error en cierre automático');
      }
    }
  });
}

/**
 * Diario a las 9:00 AM: avisa a productores 48 hs antes del cierre.
 */
export function iniciarJobRecordatorioCierre() {
  cron.schedule('0 9 * * *', async () => {
    logger.info('Job: recordatorios 48 hs');

    const en24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const en48h = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const proximas = await prisma.campana.findMany({
      where: { tipo: 'COLECTIVA', estado: 'ABIERTA', fechaCierre: { gt: en24h, lt: en48h } }
    });

    for (const campana of proximas) {
      eventBus.emit('CAMPANA_PROXIMA_A_CERRAR', { campanaId: campana.id });
    }
  });
}
```

`backend/src/jobs/index.js`:

```javascript
import { iniciarJobCierreAutomatico, iniciarJobRecordatorioCierre } from './campanas.job.js';

export function iniciarJobs() {
  iniciarJobCierreAutomatico();
  iniciarJobRecordatorioCierre();
}
```

Activar en `server.js`:

```javascript
import { iniciarJobs } from './jobs/index.js';
// ...
iniciarJobs();
```

### 5. Frontend

```
frontend/src/features/campanas/
├── api/campanas.api.js
├── pages/
│   ├── CampanasListPage.jsx         # Listado (vistas distintas según rol)
│   ├── CampanaDetailPage.jsx        # Detalle de campaña
│   └── CampanaFormPage.jsx          # Crear/editar (admin) — incluye selector de tipo
└── components/
    ├── CampanaCard.jsx              # Card mobile-first para productor
    ├── TipoBadge.jsx                # Badge del tipo (Colectiva/Directa/Continua)
    ├── EstadoBadge.jsx              # Badge de estado con colores
    ├── ProgresoVolumen.jsx          # Barra de progreso volumen (solo si hay mínimo)
    └── AccionesCampana.jsx          # Botones de transición según tipo+estado (admin)
```

**Reglas de UI según tipo:**

- El formulario de creación (`CampanaFormPage`) muestra primero un **selector de tipo**. Según la elección, muestra/oculta campos: COLECTIVA pide volumen mínimo y fecha de cierre; DIRECTA pide proveedor y precio; CONTINUA no pide fecha de cierre.
- `AccionesCampana` renderiza los botones de transición usando `transicionesDisponibles(tipo, estado)` — así el admin nunca ve una acción inválida (ej. "Enviar a licitación" no aparece en una DIRECTA).
- `ProgresoVolumen` solo se muestra cuando hay `volumenMinimo` (COLECTIVA/CONTINUA). Una DIRECTA no tiene barra de progreso.

#### `CampanaCard.jsx` (mobile-first)

```jsx
import { Link } from 'react-router-dom';

export function CampanaCard({ campana }) {
  // Solo hay barra de progreso si el proceso tiene volumen mínimo (no en DIRECTA).
  const tieneVolumenMinimo = campana.volumenMinimo && Number(campana.volumenMinimo) > 0;

  return (
    <Link to={`/campanas/${campana.id}`}
          className="block bg-white p-4 rounded-lg border shadow-sm active:bg-gray-50">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-lg">{campana.nombre}</h3>
        <div className="flex gap-1">
          <TipoBadge tipo={campana.tipo} />
          <EstadoBadge estado={campana.estado} />
        </div>
      </div>
      {campana.fechaCierre && (
        <p className="text-sm text-gray-600 mb-3">
          Cierra: {new Date(campana.fechaCierre).toLocaleDateString('es-AR')}
        </p>
      )}
      {tieneVolumenMinimo && (
        <ProgresoVolumen
          acumulado={campana.volumenAcumulado}
          minimo={campana.volumenMinimo}
          unidad={campana.producto.unidadMedida}
        />
      )}
      <p className="text-xs text-gray-500 mt-2">
        {campana.cantidadProductores} productores se sumaron
      </p>
    </Link>
  );
}
```

---

### 6. Auth: `forgot-password` / `reset-password` (heredado de Fase 1)

> Resuelto en `DECISIONES-PENDIENTES.md` #5: estos dos endpoints ya estaban documentados en `03-API-ENDPOINTS.md` desde Fase 1, pero nunca se implementaron porque dependían de `email.service.js`, que recién se construye acá. Se implementan en esta fase, reutilizando la infra de Nodemailer/plantillas de la sección anterior — no arrancan un flujo de email por separado.

Agregar al schema (`02-MODELO-DATOS.md`):

```prisma
model PasswordResetToken {
  id         Int       @id @default(autoincrement())
  usuarioId  Int       @map("usuario_id")
  usuario    Usuario   @relation(fields: [usuarioId], references: [id])

  tokenHash  String    @unique @map("token_hash")
  expiraAt   DateTime  @map("expira_at")
  usadoAt    DateTime? @map("usado_at")

  createdAt  DateTime  @default(now()) @map("created_at")

  @@index([usuarioId])
  @@map("password_reset_tokens")
}
```

Tareas en `backend/src/modules/auth/`:

- `auth.service.js`: `solicitarResetPassword(email)` — genera un token random (igual patrón que `RefreshToken`: se guarda el hash, no el token plano), crea `PasswordResetToken` con expiración corta (1 hora), y llama a `emailService.enviarPlantilla` con el link (`${FRONTEND_URL}/reset-password?token=...`). Responde 200 **siempre**, exista o no el email, para no filtrar qué emails están registrados.
- `auth.service.js`: `resetearPassword(token, nuevaPassword)` — busca el token por hash, valida que no esté vencido ni usado, actualiza `passwordHash` del usuario, marca el token como usado (`usadoAt`), y revoca todos los `RefreshToken` activos del usuario (si le resetearon la contraseña, las sesiones viejas no deberían seguir vivas).
- `auth.schemas.js`: `forgotPasswordSchema` (`email`), `resetPasswordSchema` (`token`, `nuevaPassword` con la misma validación de fuerza que el registro).
- `auth.routes.js`: `POST /forgot-password` y `POST /reset-password`, ambos públicos (sin `authenticate`).
- Plantilla de email nueva: `email-templates/reset_password.html`.

---

## Endpoints nuevos (actualizar también `03-API-ENDPOINTS.md`)

A los endpoints de campañas ya previstos se suman dos acciones específicas por tipo:

| Método | Ruta | Rol | Acción |
|--------|------|-----|--------|
| `POST` | `/api/campanas/:id/adjudicar-directa` | ADMIN | Adjudica una compra DIRECTA (body: `adjudicarDirectaSchema`). |
| `POST` | `/api/campanas/:id/generar-tanda` | ADMIN | Dispara una tanda de un proceso CONTINUA (body: `generarTandaSchema`). |

El resto de transiciones (`abrir`, `cerrar-intenciones`, `cancelar`) siguen igual; el service ya valida internamente que la transición sea válida para el `tipo`.

---

## Tests

**COLECTIVA (caso base):**
- Crear COLECTIVA con datos válidos → BORRADOR.
- Crear COLECTIVA sin volumen mínimo → 400.
- Crear COLECTIVA con fechaCierre < fechaApertura → 400.
- Transición BORRADOR → ABIERTA → OK.
- Transición BORRADOR → ADJUDICADA en COLECTIVA → 409 (debe pasar por licitación).
- Cancelar campaña ya CERRADA → 409.
- Cron de cierre automático: crear COLECTIVA con fechaCierre pasada, simular tick del cron, verificar que pasa a EN_LICITACION.

**DIRECTA:**
- Crear DIRECTA sin volumen mínimo ni fecha de cierre → OK (BORRADOR).
- `adjudicarDirecta` desde ABIERTA → ADJUDICADA + emite `COMPRA_DIRECTA_ADJUDICADA`.
- `cerrarIntenciones` sobre una DIRECTA → 409 (no licita).
- Cron de cierre NO toca DIRECTA.

**CONTINUA:**
- Crear CONTINUA ignora fechaCierre (queda null) → OK.
- `generarTanda` con intenciones acumuladas → crea campaña hija con `campanaPadreId` seteado y re-vincula las intenciones; el padre sigue ABIERTA.
- `generarTanda` sin intenciones → 400.
- Cron de cierre NO toca CONTINUA.

---

## Checklist de cierre

- [ ] Migración `add_campanas` aplicada (incluye `tipo`, nullable en volumen/fechaCierre, self-relation de tandas).
- [ ] Endpoints `/api/campanas/*` funcionan, incluyendo transiciones por tipo.
- [ ] Los 3 tipos (COLECTIVA/DIRECTA/CONTINUA) se pueden crear y transicionar según su mapa.
- [ ] `adjudicarDirecta` y `generarTanda` funcionan y emiten sus eventos.
- [ ] Cron jobs registrados y probados (frecuencia de cada minuto para verificar) y solo tocan COLECTIVA.
- [ ] Eventos `CAMPANA_ABIERTA`, `CAMPANA_CERRADA`, `RFQ_ABIERTO`, `COMPRA_DIRECTA_ADJUDICADA`, `TANDA_GENERADA` se emiten.
- [ ] Frontend muestra listado y detalle con badges de tipo y acciones válidas por tipo.
- [ ] `POST /api/auth/forgot-password` y `POST /api/auth/reset-password` operativos (migración `PasswordResetToken` incluida).
- [ ] Coverage ≥ 60%.
- [ ] Tag: `v0.4-fase-4-campanas`.

---

## Próximo paso

[`10-FASE-5-INTENCIONES.md`](./10-FASE-5-INTENCIONES.md)
