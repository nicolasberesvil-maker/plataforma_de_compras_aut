# Fase 5 — Intenciones y Solicitudes de Compra (Portal Productor)

> **Sprint:** 6 (1 semana)
> **Objetivo:** El productor carga su pedido desde el celular, ya sea dentro de una campaña abierta por AUT o como una solicitud suelta que dispara el proceso. Punto crítico de adopción del sistema.

---

## Contexto: dos caminos hacia la misma compra (regla D.1)

Hasta la Fase 4, el único camino era **top-down**: AUT abre la campaña, el productor entra y carga su intención. Esta fase agrega el camino **bottom-up**, que es como AUT describe que realmente arranca buena parte de las compras: el productor pide algo puntual ("necesito 500 L de glifosato para mediados de septiembre, entregame en el campo, prefiero pagar con canje") **sin que exista campaña todavía**. El ADMIN revisa esos pedidos sueltos (`SolicitudCompra`) en una bandeja y decide si los agrupa en un requerimiento de compra colectiva.

Los dos caminos conviven y terminan en el mismo lugar (una `IntencionCompra` dentro de una `Campana` ABIERTA):

```
Camino top-down (Fase 4):        ADMIN crea Campana → la abre → productor carga IntencionCompra directo

Camino bottom-up (esta fase):    Productor crea SolicitudCompra → ADMIN la revisa →
                                  ADMIN agrupa (POST /api/solicitudes/agrupar) →
                                  se crea la Campana + se genera 1 IntencionCompra por solicitud agrupada
```

---

## Resultado esperado

- Productor logueado puede cargar una **solicitud de compra** en cualquier momento (sin esperar que exista una campaña): qué producto, cuánto, para cuándo, a qué dirección y con qué forma de pago preferiría pagar.
- ADMIN ve una bandeja de solicitudes pendientes y puede **agruparlas** en un nuevo requerimiento (`Campana`) o descartarlas.
- Productor logueado ve listado de campañas abiertas en formato mobile-first.
- Puede entrar a una campaña y cargar/editar su intención de compra (con fecha deseada, dirección/depósito y forma de pago preferida).
- Puede ver, modificar y eliminar sus intenciones y solicitudes (mientras estén en estado editable).
- El volumen acumulado se actualiza en tiempo real via Socket.io.
- Bloqueo automático de edición N horas antes del cierre (`horasLockoutEdicion`).

---

## Prerrequisitos

- Fase 4 completa. Campañas funcionando.
- Socket.io activado en `server.js`.

---

## Tareas

### 1. Schema Prisma

> **Actualización (2026-07):** ya no se crea `SolicitudCompra` como modelo separado — se unificó con `IntencionCompra` en la migración de Fase 4 (`campanaId` nullable; ver `02-MODELO-DATOS.md` nota #9 y `09-FASE-4-CAMPANAS.md` tarea 1). Esta fase **no agrega modelos nuevos**: `IntencionCompra` ya existe completo desde Fase 4 (incluye `fechaDeseada`, `direccionEntregaCampo`, `formaPagoPreferida`, `estado`). Si en el camino aparece un campo que Fase 4 no previó, se agrega con su propia migración chica acá.
>
> **Pendiente al arrancar esta fase:** las secciones 2-5 de abajo (código de `solicitudes.service.js`, schemas, endpoints `/api/solicitudes/*`) todavía hablan de `prisma.solicitudCompra` y de "convertir" una solicitud en intención — hay que releerlas contra el modelo unificado antes de implementar: "crear solicitud" pasa a ser "crear `IntencionCompra` con `campanaId: null`" y "agrupar" pasa a ser un `updateMany` de `campanaId` + `estado: 'AGRUPADA'` sobre intenciones existentes, no una creación nueva. No se reescribe ese detalle ahora para no adelantar trabajo de una fase que todavía no arrancó.

### 2. Módulo `solicitudes`

```
backend/src/modules/solicitudes/
├── solicitudes.controller.js
├── solicitudes.service.js
├── solicitudes.routes.js
├── solicitudes.schemas.js
└── solicitudes.test.js
```

#### `solicitudes.schemas.js`

```javascript
import { z } from 'zod';

// Refinamiento: si la modalidad es ENTREGA_EN_CAMPO, direccionEntrega es
// obligatoria; si es RETIRO_EN_DEPOSITO, se espera depositoPreferidoId.
// Se valida acá (no solo en el service) para dar feedback inmediato en el form.
export const crearSolicitudSchema = z.object({
  productoId: z.number().int().positive(),
  volumenDeseado: z.number().positive(),
  fechaDeseada: z.coerce.date(),
  modalidadEntregaPreferida: z.enum(['RETIRO_EN_DEPOSITO', 'ENTREGA_EN_CAMPO']),
  direccionEntrega: z.string().min(5).optional(),
  depositoPreferidoId: z.number().int().positive().optional(),
  formaPagoPreferida: z.enum([
    'TRANSFERENCIA', 'ECHEQ_CORRIENTE', 'ECHEQ_PLAZO',
    'TARJETA_AGRO', 'CANJE_CEREAL', 'CUENTA_CORRIENTE', 'EFECTIVO'
  ]).optional(),
  observaciones: z.string().max(1000).optional()
}).refine(
  (d) => d.modalidadEntregaPreferida !== 'ENTREGA_EN_CAMPO' || !!d.direccionEntrega,
  { message: 'La dirección es obligatoria cuando la entrega es en campo', path: ['direccionEntrega'] }
);

export const actualizarSolicitudSchema = crearSolicitudSchema;

export const descartarSolicitudSchema = z.object({
  motivo: z.string().min(5).max(500)
});

// Agrupar N solicitudes en una Campana nueva. fechaCierre viene pre-cargada
// en el frontend a "ahora + 48hs" (sugerencia del negocio), pero es editable:
// no se valida como regla dura acá, es una decisión del ADMIN caso a caso.
export const agruparSolicitudesSchema = z.object({
  solicitudIds: z.array(z.number().int().positive()).min(1),
  nombre: z.string().min(3).max(150),
  fechaCierre: z.coerce.date(),
  fechaEstimadaRecepcion: z.coerce.date().optional(),
  volumenMinimo: z.number().positive().optional(),
  horasLockoutEdicion: z.number().int().nonnegative().default(0)
});
```

#### `solicitudes.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';
import * as campanaService from '../campanas/campanas.service.js';

export async function crear(datos, usuarioId) {
  const productor = await obtenerProductorDelUsuario(usuarioId);
  if (!productor.aprobado) throw new ForbiddenError('Productor no aprobado');

  const solicitud = await prisma.solicitudCompra.create({
    data: { ...datos, productorId: productor.id, estado: 'PENDIENTE' },
    include: { producto: true }
  });

  // Notifica al equipo de AUT (ADMIN/OPERADOR), no a otros productores:
  // en este punto todavía no existe ningún requerimiento público.
  eventBus.emit('SOLICITUD_RECIBIDA', {
    solicitudId: solicitud.id,
    productoId: solicitud.productoId,
    productorId: productor.id
  });

  return solicitud;
}

export async function listarMias(usuarioId) {
  const productor = await obtenerProductorDelUsuario(usuarioId);
  return prisma.solicitudCompra.findMany({
    where: { productorId: productor.id },
    include: { producto: true, campanaGenerada: true },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Bandeja de solicitudes para el ADMIN. Filtra por estado y producto para
 * facilitar agrupar solicitudes del mismo insumo.
 */
export async function listar({ estado, productoId, page = 1, limit = 20 }) {
  const where = {};
  if (estado) where.estado = estado;
  if (productoId) where.productoId = productoId;

  const [data, total] = await Promise.all([
    prisma.solicitudCompra.findMany({
      where,
      include: { producto: true, productor: { include: { usuario: true } } },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'asc' }
    }),
    prisma.solicitudCompra.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function actualizar(id, datos, usuarioId) {
  const solicitud = await obtenerPropia(id, usuarioId);
  if (solicitud.estado !== 'PENDIENTE') {
    throw new ConflictError('Solo se puede editar una solicitud PENDIENTE');
  }
  return prisma.solicitudCompra.update({ where: { id }, data: datos });
}

export async function eliminar(id, usuarioId) {
  const solicitud = await obtenerPropia(id, usuarioId);
  if (solicitud.estado !== 'PENDIENTE') {
    throw new ConflictError('Solo se puede retirar una solicitud PENDIENTE');
  }
  await prisma.solicitudCompra.delete({ where: { id } });
}

export async function descartar(id, motivo) {
  const solicitud = await prisma.solicitudCompra.findUnique({ where: { id } });
  if (!solicitud) throw new NotFoundError('Solicitud');
  if (solicitud.estado !== 'PENDIENTE') throw new ConflictError('La solicitud ya fue procesada');

  const actualizada = await prisma.solicitudCompra.update({
    where: { id },
    data: { estado: 'DESCARTADA', motivoDescarte: motivo }
  });

  eventBus.emit('SOLICITUD_DESCARTADA', { solicitudId: id, productorId: solicitud.productorId, motivo });
  return actualizada;
}

/**
 * EL CORAZÓN DEL FLUJO BOTTOM-UP: agrupa N solicitudes (normalmente del mismo
 * producto) en una Campana nueva. Todo en una transacción porque si falla a
 * mitad de camino, NO queremos solicitudes marcadas AGRUPADA sin una campaña
 * real detrás (regla de oro de Prisma transactions, ver AGENT-INSTRUCTIONS.md).
 */
export async function agrupar(datos, usuario) {
  const { solicitudIds, nombre, fechaCierre, fechaEstimadaRecepcion, volumenMinimo, horasLockoutEdicion } = datos;

  const resultado = await prisma.$transaction(async (tx) => {
    const solicitudes = await tx.solicitudCompra.findMany({
      where: { id: { in: solicitudIds }, estado: 'PENDIENTE' }
    });
    if (solicitudes.length !== solicitudIds.length) {
      throw new ValidationError('Alguna solicitud no existe o ya no está PENDIENTE');
    }
    // Todas deben ser del mismo producto: es lo que hace que tenga sentido
    // licitarlas juntas ante los mismos proveedores.
    const productoId = solicitudes[0].productoId;
    if (solicitudes.some(s => s.productoId !== productoId)) {
      throw new ValidationError('Todas las solicitudes agrupadas deben ser del mismo producto');
    }

    const campana = await tx.campana.create({
      data: {
        productoId,
        tipo: 'COLECTIVA',
        nombre,
        volumenMinimo: volumenMinimo ?? null,
        fechaApertura: new Date(),
        fechaCierre,
        fechaEstimadaRecepcion: fechaEstimadaRecepcion ?? null,
        horasLockoutEdicion: horasLockoutEdicion ?? 0,
        estado: 'ABIERTA', // nace directamente abierta: las solicitudes YA son voluntad de compra
        creadaPorId: usuario.id
      }
    });

    const intenciones = [];
    for (const s of solicitudes) {
      const intencion = await tx.intencionCompra.create({
        data: {
          campanaId: campana.id,
          productorId: s.productorId,
          volumen: s.volumenDeseado,
          observaciones: s.observaciones,
          fechaDeseada: s.fechaDeseada,
          modalidadEntregaPreferida: s.modalidadEntregaPreferida,
          depositoPreferidoId: s.depositoPreferidoId,
          direccionEntregaCampo: s.direccionEntrega,
          formaPagoPreferida: s.formaPagoPreferida,
          solicitudOrigenId: s.id
        }
      });
      await tx.solicitudCompra.update({
        where: { id: s.id },
        data: { estado: 'AGRUPADA', campanaGeneradaId: campana.id }
      });
      intenciones.push(intencion);
    }

    return { campana, intenciones, solicitudes };
  });

  // Eventos post-transacción: aviso masivo (por si hay más interesados que
  // nunca cargaron solicitud) + aviso personalizado a cada originador.
  eventBus.emit('CAMPANA_ABIERTA', { campanaId: resultado.campana.id, productoId: resultado.campana.productoId });
  for (const s of resultado.solicitudes) {
    eventBus.emit('SOLICITUD_AGRUPADA', {
      solicitudId: s.id,
      productorId: s.productorId,
      campanaId: resultado.campana.id,
      intencionId: resultado.intenciones.find(i => i.solicitudOrigenId === s.id)?.id
    });
  }

  return resultado.campana;
}

// ============================================================

async function obtenerProductorDelUsuario(usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) throw new ForbiddenError('Usuario no es productor');
  return productor;
}

async function obtenerPropia(id, usuarioId) {
  const solicitud = await prisma.solicitudCompra.findUnique({ where: { id } });
  if (!solicitud) throw new NotFoundError('Solicitud');
  const productor = await obtenerProductorDelUsuario(usuarioId);
  if (solicitud.productorId !== productor.id) throw new ForbiddenError();
  return solicitud;
}
```

**Por qué `agrupar` no reutiliza `campanaService.crear()` + `abrir()` tal cual:** porque necesita, en la MISMA transacción, crear la campaña, generar las intenciones y marcar las solicitudes como usadas. Si se llamara a los services de campañas/intenciones por separado (cada uno con su propia conexión/transacción), un fallo a mitad de camino podría dejar una campaña sin intenciones o solicitudes "colgadas". Se prioriza atomicidad sobre reutilización de código en este punto puntual.

### 3. Módulo `intenciones`

```
backend/src/modules/intenciones/
├── intenciones.controller.js
├── intenciones.service.js
├── intenciones.routes.js
├── intenciones.schemas.js
└── intenciones.test.js
```

#### `intenciones.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';
import { socketService } from '../../services/socket.service.js';

export async function listarMias(usuarioId) {
  const productor = await obtenerProductorDelUsuario(usuarioId);

  return prisma.intencionCompra.findMany({
    where: { productorId: productor.id },
    include: { campana: { include: { producto: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

export async function obtenerPorId(id, usuario) {
  const intencion = await prisma.intencionCompra.findUnique({
    where: { id },
    include: { campana: true, productor: true }
  });
  if (!intencion) throw new NotFoundError('Intención');

  // Validar ownership
  if (usuario.rol === 'PRODUCTOR') {
    const productor = await obtenerProductorDelUsuario(usuario.id);
    if (intencion.productorId !== productor.id) throw new ForbiddenError();
  }

  return intencion;
}

export async function crear(datos, usuarioId) {
  const productor = await obtenerProductorDelUsuario(usuarioId);
  if (!productor.aprobado) throw new ForbiddenError('Productor no aprobado');

  // Validar campaña
  const campana = await prisma.campana.findUnique({ where: { id: datos.campanaId } });
  if (!campana) throw new NotFoundError('Campaña');
  if (campana.estado !== 'ABIERTA') throw new ConflictError('La campaña no está abierta');

  // Validar lockout (N horas antes del cierre)
  validarLockout(campana);

  // Validar volumen máximo
  if (campana.volumenMaximo) {
    const stats = await prisma.intencionCompra.aggregate({
      where: { campanaId: campana.id },
      _sum: { volumen: true }
    });
    const acumulado = Number(stats._sum.volumen ?? 0);
    if (acumulado + datos.volumen > Number(campana.volumenMaximo)) {
      throw new ValidationError('Se superaría el volumen máximo de la campaña');
    }
  }

  // Validar que no haya intención previa (upsert lógico)
  const existente = await prisma.intencionCompra.findUnique({
    where: { campanaId_productorId: { campanaId: campana.id, productorId: productor.id } }
  });
  if (existente) {
    throw new ConflictError('Ya cargaste una intención. Editala en vez de crear una nueva.');
  }

  // Si la modalidad es ENTREGA_EN_CAMPO, la dirección es obligatoria: es el
  // dato que el ADMIN necesita volcar en el pedido de cotización al proveedor.
  if (datos.modalidadEntregaPreferida === 'ENTREGA_EN_CAMPO' && !datos.direccionEntregaCampo) {
    throw new ValidationError('La dirección de entrega es obligatoria para entrega en campo');
  }

  const intencion = await prisma.intencionCompra.create({
    data: {
      campanaId: datos.campanaId,
      productorId: productor.id,
      volumen: datos.volumen,
      observaciones: datos.observaciones,
      fechaDeseada: datos.fechaDeseada,
      modalidadEntregaPreferida: datos.modalidadEntregaPreferida,
      depositoPreferidoId: datos.depositoPreferidoId,
      direccionEntregaCampo: datos.direccionEntregaCampo,
      formaPagoPreferida: datos.formaPagoPreferida
    },
    include: { campana: { include: { producto: true } } }
  });

  // Evento + actualización en tiempo real para todos los suscriptos
  eventBus.emit('INTENCION_CARGADA', {
    intencionId: intencion.id,
    campanaId: campana.id,
    productorId: productor.id,
    volumen: intencion.volumen
  });

  await notificarActualizacionCampana(campana.id);

  return intencion;
}

export async function actualizar(id, datos, usuarioId) {
  const intencion = await prisma.intencionCompra.findUnique({
    where: { id },
    include: { campana: true, productor: true }
  });
  if (!intencion) throw new NotFoundError('Intención');

  const productor = await obtenerProductorDelUsuario(usuarioId);
  if (intencion.productorId !== productor.id) throw new ForbiddenError();

  if (intencion.campana.estado !== 'ABIERTA') {
    throw new ConflictError('La campaña ya no está abierta');
  }
  validarLockout(intencion.campana);

  const actualizada = await prisma.intencionCompra.update({
    where: { id },
    data: {
      volumen: datos.volumen,
      observaciones: datos.observaciones,
      fechaDeseada: datos.fechaDeseada,
      modalidadEntregaPreferida: datos.modalidadEntregaPreferida,
      depositoPreferidoId: datos.depositoPreferidoId,
      direccionEntregaCampo: datos.direccionEntregaCampo,
      formaPagoPreferida: datos.formaPagoPreferida
    },
    include: { campana: { include: { producto: true } } }
  });

  await notificarActualizacionCampana(intencion.campanaId);
  return actualizada;
}

export async function eliminar(id, usuarioId) {
  const intencion = await obtenerPorId(id, { id: usuarioId, rol: 'PRODUCTOR' });
  if (intencion.campana.estado !== 'ABIERTA') {
    throw new ConflictError('La campaña ya no está abierta');
  }
  validarLockout(intencion.campana);

  await prisma.intencionCompra.delete({ where: { id } });
  await notificarActualizacionCampana(intencion.campanaId);
}

// ============================================================
// Helpers
// ============================================================

async function obtenerProductorDelUsuario(usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) throw new ForbiddenError('Usuario no es productor');
  return productor;
}

function validarLockout(campana) {
  if (campana.horasLockoutEdicion === 0) return;

  const lockout = new Date(campana.fechaCierre);
  lockout.setHours(lockout.getHours() - campana.horasLockoutEdicion);

  if (new Date() >= lockout) {
    throw new ConflictError(
      `La edición está bloqueada (${campana.horasLockoutEdicion} hs antes del cierre)`
    );
  }
}

async function notificarActualizacionCampana(campanaId) {
  const stats = await prisma.intencionCompra.aggregate({
    where: { campanaId },
    _sum: { volumen: true },
    _count: true
  });

  // Emitir vía Socket.io a todos los suscriptos a esta campaña
  socketService.emitirAlaCampana(campanaId, 'campana:actualizada', {
    campanaId,
    volumenAcumulado: Number(stats._sum.volumen ?? 0),
    cantidadProductores: stats._count
  });
}
```

#### `intenciones.schemas.js`

```javascript
import { z } from 'zod';

export const crearIntencionSchema = z.object({
  campanaId: z.number().int().positive(),
  volumen: z.number().positive(),
  observaciones: z.string().max(1000).optional(),
  fechaDeseada: z.coerce.date().optional(),
  modalidadEntregaPreferida: z.enum(['RETIRO_EN_DEPOSITO', 'ENTREGA_EN_CAMPO']).optional(),
  depositoPreferidoId: z.number().int().positive().optional(),
  direccionEntregaCampo: z.string().min(5).optional(),
  formaPagoPreferida: z.enum([
    'TRANSFERENCIA', 'ECHEQ_CORRIENTE', 'ECHEQ_PLAZO',
    'TARJETA_AGRO', 'CANJE_CEREAL', 'CUENTA_CORRIENTE', 'EFECTIVO'
  ]).optional()
}).refine(
  (d) => d.modalidadEntregaPreferida !== 'ENTREGA_EN_CAMPO' || !!d.direccionEntregaCampo,
  { message: 'La dirección es obligatoria cuando la entrega es en campo', path: ['direccionEntregaCampo'] }
);

export const actualizarIntencionSchema = crearIntencionSchema.partial().omit({ campanaId: true });
```

### 4. Frontend: portal productor

```
frontend/src/features/intenciones/
├── api/intenciones.api.js
├── pages/
│   ├── MisIntencionesPage.jsx     # Listado de intenciones del productor
│   └── CargarIntencionPage.jsx    # Form para cargar/editar en una campaña
└── components/
    ├── IntencionForm.jsx           # Form principal
    └── IntencionCard.jsx           # Card de intención en listado

frontend/src/features/solicitudes/
├── api/solicitudes.api.js
├── pages/
│   ├── MisSolicitudesPage.jsx      # Vista productor: mis pedidos sueltos + estado
│   ├── NuevaSolicitudPage.jsx      # Form: "Pedir un producto" (sin campaña)
│   ├── BandejaSolicitudesPage.jsx  # Vista ADMIN: pendientes para agrupar/descartar
│   └── AgruparSolicitudesPage.jsx  # ADMIN selecciona N solicitudes → arma la Campana
└── components/
    ├── SolicitudForm.jsx           # Producto, volumen, fecha deseada, dirección, forma de pago
    ├── SolicitudCard.jsx           # Card con badge de estado (PENDIENTE/AGRUPADA/DESCARTADA)
    └── AgruparSolicitudesModal.jsx # Selección múltiple + datos de la campaña a crear
```

**Nota de UX (regla de negocio "brutalmente simple", ver `00-VISION-NEGOCIO.md`):** el portal productor debe mostrar **un solo botón principal** de entrada, algo como "Pedir un producto". Si hay una campaña abierta para ese producto, lo manda al form de `IntencionForm` dentro de ella; si no hay ninguna, lo manda a `SolicitudForm`. El productor no debería tener que entender la diferencia técnica entre "intención" y "solicitud" — para él es siempre "pedí tal cosa".

#### `SolicitudForm.jsx` (mobile-first, camino bottom-up)

```jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { solicitudesApi } from '../api/solicitudes.api';

const schema = z.object({
  productoId: z.coerce.number().int().positive(),
  volumenDeseado: z.coerce.number().positive('Ingresá una cantidad mayor a 0'),
  fechaDeseada: z.string().min(1, 'Elegí para cuándo lo necesitás'),
  modalidadEntregaPreferida: z.enum(['RETIRO_EN_DEPOSITO', 'ENTREGA_EN_CAMPO']),
  direccionEntrega: z.string().optional(),
  depositoPreferidoId: z.coerce.number().int().positive().optional(),
  formaPagoPreferida: z.string().optional(),
  observaciones: z.string().optional()
});

export function SolicitudForm({ productos, depositos = [] }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { modalidadEntregaPreferida: 'RETIRO_EN_DEPOSITO' }
  });
  const modalidad = watch('modalidadEntregaPreferida');

  const mutation = useMutation({ mutationFn: (data) => solicitudesApi.crear(data) });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5 p-4">
      <div>
        <label className="block text-base font-medium mb-2">¿Qué producto necesitás?</label>
        <select {...register('productoId')} className="w-full px-4 py-3 border-2 rounded-lg text-base">
          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-base font-medium mb-2">¿Cuánto necesitás?</label>
        <input {...register('volumenDeseado')} type="number" inputMode="decimal" step="0.01"
               className="w-full px-4 py-4 text-xl border-2 rounded-lg" placeholder="Ej: 500" />
        {errors.volumenDeseado && <p className="text-red-600 text-sm mt-1">{errors.volumenDeseado.message}</p>}
      </div>

      <div>
        <label className="block text-base font-medium mb-2">¿Para cuándo lo necesitás?</label>
        <input {...register('fechaDeseada')} type="date" className="w-full px-4 py-3 border-2 rounded-lg text-base" />
        {errors.fechaDeseada && <p className="text-red-600 text-sm mt-1">{errors.fechaDeseada.message}</p>}
      </div>

      <div>
        <label className="block text-base font-medium mb-2">Cómo preferís recibirlo</label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer has-[:checked]:border-aut-verde has-[:checked]:bg-green-50">
            <input {...register('modalidadEntregaPreferida')} type="radio" value="RETIRO_EN_DEPOSITO" />
            <span>Retiro en depósito de AUT</span>
          </label>
          <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer has-[:checked]:border-aut-verde has-[:checked]:bg-green-50">
            <input {...register('modalidadEntregaPreferida')} type="radio" value="ENTREGA_EN_CAMPO" />
            <span>Entrega en mi campo</span>
          </label>
        </div>
      </div>

      {modalidad === 'ENTREGA_EN_CAMPO' ? (
        <div>
          <label className="block text-base font-medium mb-2">Dirección de entrega</label>
          <input {...register('direccionEntrega')} type="text"
                 className="w-full px-4 py-3 border-2 rounded-lg text-base"
                 placeholder="Ej: Campo La Esperanza, Ruta 13 km 4" />
        </div>
      ) : (
        <div>
          <label className="block text-base font-medium mb-2">¿De qué depósito preferís retirar?</label>
          <select {...register('depositoPreferidoId')} className="w-full px-4 py-3 border-2 rounded-lg text-base">
            <option value="">Sin preferencia</option>
            {depositos.map(d => <option key={d.id} value={d.id}>{d.nombre} ({d.localidad})</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-base font-medium mb-2">¿Cómo preferís pagar?</label>
        <select {...register('formaPagoPreferida')} className="w-full px-4 py-3 border-2 rounded-lg text-base">
          <option value="">Sin preferencia</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="ECHEQ_CORRIENTE">E-cheq corriente</option>
          <option value="ECHEQ_PLAZO">E-cheq a plazo</option>
          <option value="TARJETA_AGRO">Tarjeta agro</option>
          <option value="CANJE_CEREAL">Canje cereal</option>
          <option value="CUENTA_CORRIENTE">Cuenta corriente con AUT</option>
          <option value="EFECTIVO">Efectivo</option>
        </select>
      </div>

      <button type="submit" disabled={mutation.isPending}
              className="w-full bg-aut-verde text-white py-4 rounded-lg font-semibold text-lg disabled:opacity-50">
        {mutation.isPending ? 'Enviando...' : 'Pedir este producto'}
      </button>
    </form>
  );
}
```

#### `IntencionForm.jsx` (mobile-first crítico)

```jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { intencionesApi } from '../api/intenciones.api';

const schema = z.object({
  volumen: z.coerce.number().positive('Ingresá un volumen mayor a 0'),
  observaciones: z.string().optional(),
  fechaDeseada: z.string().optional(),
  modalidadEntregaPreferida: z.enum(['RETIRO_EN_DEPOSITO', 'ENTREGA_EN_CAMPO']).optional(),
  depositoPreferidoId: z.coerce.number().int().positive().optional(),
  direccionEntregaCampo: z.string().optional(),
  formaPagoPreferida: z.string().optional()
});

export function IntencionForm({ campana, intencionExistente, depositos = [] }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: intencionExistente || {
      modalidadEntregaPreferida: 'RETIRO_EN_DEPOSITO'
    }
  });

  const modalidad = watch('modalidadEntregaPreferida');

  const mutation = useMutation({
    mutationFn: (data) => intencionExistente
      ? intencionesApi.actualizar(intencionExistente.id, data)
      : intencionesApi.crear({ ...data, campanaId: campana.id }),
    onSuccess: () => {
      queryClient.invalidateQueries(['intenciones']);
      queryClient.invalidateQueries(['campanas', campana.id]);
    }
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5 p-4">
      <div>
        <label className="block text-base font-medium mb-2">
          ¿Cuánto necesitás? ({campana.producto.unidadMedida.toLowerCase()})
        </label>
        <input
          {...register('volumen')}
          type="number"
          inputMode="decimal"
          step="0.01"
          autoFocus
          className="w-full px-4 py-4 text-xl border-2 rounded-lg"
          placeholder="Ej: 500"
        />
        {errors.volumen && <p className="text-red-600 text-sm mt-1">{errors.volumen.message}</p>}
      </div>

      <div>
        <label className="block text-base font-medium mb-2">Cómo preferís recibirlo</label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer has-[:checked]:border-aut-verde has-[:checked]:bg-green-50">
            <input {...register('modalidadEntregaPreferida')} type="radio" value="RETIRO_EN_DEPOSITO" />
            <span>Retiro en depósito de AUT</span>
          </label>
          <label className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer has-[:checked]:border-aut-verde has-[:checked]:bg-green-50">
            <input {...register('modalidadEntregaPreferida')} type="radio" value="ENTREGA_EN_CAMPO" />
            <span>Entrega en mi campo</span>
          </label>
        </div>
      </div>

      {modalidad === 'RETIRO_EN_DEPOSITO' && depositos.length > 1 && (
        <div>
          <label className="block text-base font-medium mb-2">¿De qué depósito preferís retirar?</label>
          <select {...register('depositoPreferidoId')} className="w-full px-4 py-3 border-2 rounded-lg text-base">
            <option value="">Sin preferencia</option>
            {depositos.map(d => (
              <option key={d.id} value={d.id}>{d.nombre} ({d.localidad})</option>
            ))}
          </select>
        </div>
      )}

      {modalidad === 'ENTREGA_EN_CAMPO' && (
        <div>
          <label className="block text-base font-medium mb-2">Dirección de entrega</label>
          <input {...register('direccionEntregaCampo')} type="text"
                 className="w-full px-4 py-3 border-2 rounded-lg text-base"
                 placeholder="Ej: Campo La Esperanza, Ruta 13 km 4" />
        </div>
      )}

      <div>
        <label className="block text-base font-medium mb-2">¿Para cuándo lo necesitás? (opcional)</label>
        <input {...register('fechaDeseada')} type="date" className="w-full px-4 py-3 border-2 rounded-lg text-base" />
      </div>

      <div>
        <label className="block text-base font-medium mb-2">¿Cómo preferís pagar? (opcional)</label>
        <select {...register('formaPagoPreferida')} className="w-full px-4 py-3 border-2 rounded-lg text-base">
          <option value="">Sin preferencia</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="ECHEQ_CORRIENTE">E-cheq corriente</option>
          <option value="ECHEQ_PLAZO">E-cheq a plazo</option>
          <option value="TARJETA_AGRO">Tarjeta agro</option>
          <option value="CANJE_CEREAL">Canje cereal</option>
          <option value="CUENTA_CORRIENTE">Cuenta corriente con AUT</option>
          <option value="EFECTIVO">Efectivo</option>
        </select>
      </div>

      <div>
        <label className="block text-base font-medium mb-2">Observaciones (opcional)</label>
        <textarea {...register('observaciones')}
                  rows={3}
                  className="w-full px-3 py-3 border-2 rounded-lg text-base"
                  placeholder="Ej: Para los lotes del este" />
      </div>

      {mutation.isError && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {mutation.error.response?.data?.error?.message || 'Error al guardar'}
        </div>
      )}

      <button type="submit" disabled={mutation.isPending}
              className="w-full bg-aut-verde text-white py-4 rounded-lg font-semibold text-lg disabled:opacity-50">
        {mutation.isPending ? 'Guardando...' : intencionExistente ? 'Actualizar intención' : 'Sumarme a la compra'}
      </button>
    </form>
  );
}
```

### 5. Suscripción en tiempo real al detalle de campaña

`frontend/src/features/campanas/pages/CampanaDetailPage.jsx`:

```jsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../../hooks/useSocket';
import { campanasApi } from '../api/campanas.api';

export function CampanaDetailPage() {
  const { id } = useParams();
  const socket = useSocket();
  const queryClient = useQueryClient();

  const { data: resumen } = useQuery({
    queryKey: ['campanas', id, 'resumen'],
    queryFn: () => campanasApi.obtenerResumen(id)
  });

  useEffect(() => {
    if (!socket) return;

    socket.emit('subscribe:campana', { campanaId: Number(id) });

    function handleActualizacion(data) {
      queryClient.setQueryData(['campanas', id, 'resumen'], (old) => ({
        ...old,
        volumenAcumulado: data.volumenAcumulado,
        cantidadProductores: data.cantidadProductores
      }));
    }

    socket.on('campana:actualizada', handleActualizacion);

    return () => {
      socket.emit('unsubscribe:campana', { campanaId: Number(id) });
      socket.off('campana:actualizada', handleActualizacion);
    };
  }, [socket, id, queryClient]);

  // ... render
}
```

### 6. Listeners de notificaciones (módulo `notificaciones`)

Crear `backend/src/modules/notificaciones/` con service básico (ver `04-NOTIFICACIONES.md`).

Registrar listeners en `server.js`:

```javascript
import { registrarListenersNotificaciones } from './modules/notificaciones/notificaciones.listeners.js';
registrarListenersNotificaciones();
```

En esta fase, los listeners ya empiezan a guardar notificaciones en BD aunque el frontend recién las muestre completamente en una iteración posterior. La campanita (`/api/notificaciones/no-leidas/count`) debe funcionar desde acá.

---

## Tests

**Intenciones:**
- Productor aprobado carga intención → 201.
- Productor no aprobado intenta cargar → 403.
- Cargar intención en campaña no ABIERTA → 409.
- Cargar intención con modalidad ENTREGA_EN_CAMPO sin dirección → 400.
- Editar intención dentro del lockout → 409.
- Editar intención fuera del lockout → 200.
- Eliminar intención propia → 204.
- Intentar editar intención de otro productor → 403.

**Solicitudes:**
- Productor aprobado carga solicitud sin campaña asociada → 201, estado PENDIENTE.
- Cargar solicitud ENTREGA_EN_CAMPO sin dirección → 400.
- Editar/eliminar solicitud ya AGRUPADA → 409.
- ADMIN agrupa 2 solicitudes del mismo producto → crea 1 Campana ABIERTA + 2 IntencionCompra + marca ambas AGRUPADA.
- ADMIN intenta agrupar solicitudes de productos distintos → 400.
- ADMIN intenta agrupar una solicitud ya AGRUPADA → 400.
- Descartar solicitud PENDIENTE → 200, estado DESCARTADA + motivo.
- Verificar atomicidad de `agrupar`: forzar error a mitad de la transacción y comprobar que ninguna solicitud quedó marcada AGRUPADA sin campaña.
- Evento `SOLICITUD_RECIBIDA` notifica a todos los ADMIN/OPERADOR activos.
- Evento `SOLICITUD_AGRUPADA` notifica puntualmente a cada productor originador.

---

## Checklist de cierre

- [x] Migración aplicada (`add_notificaciones`; `IntencionCompra` ya existía completa desde Fase 4, ver nota de la tarea 1).
- [x] Endpoints `/api/intenciones/*` operativos. **No existe `/api/solicitudes/*` separado**: se unificó todo en `intenciones` (ver nota de la tarea 1) — `POST /api/intenciones` sin `campanaId` es el pedido suelto.
- [x] `POST /api/intenciones/agrupar` es atómico y dispara los eventos correctos.
- [x] Form de carga mobile-first (`PedidoForm`, portal productor en `/productor`). Verificado con `npm run build` (compila sin errores); no se probó visualmente en DevTools modo móvil por no contar con herramienta de navegador en esta sesión.
- [x] Volumen acumulado en vivo verificado end-to-end contra el servidor real: dos productores autenticados por Socket.io simultáneos, uno recibe `campana:actualizada` con el volumen correcto al segundo cargar su intención.
- [x] Tabla `notificaciones` se puebla al ocurrir eventos, incluyendo ADMIN (verificado end-to-end: `SOLICITUD_RECIBIDA` crea notificación para el ADMIN, `CAMPANA_ABIERTA` para productores aprobados).
- [x] Coverage backend 60% statements / 63.9% líneas (`npm run test:coverage`).
- [x] Tag: `v0.5-fase-5-intenciones-solicitudes`.

---

## Próximo paso

[`11-FASE-6-COTIZACIONES.md`](./11-FASE-6-COTIZACIONES.md)
