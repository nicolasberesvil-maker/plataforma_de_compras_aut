# Fase 5 — Intenciones de Compra (Portal Productor)

> **Sprint:** 6 (1 semana)
> **Objetivo:** El productor carga su intención de compra desde el celular. Punto crítico de adopción del sistema.

---

## Resultado esperado

- Productor logueado ve listado de campañas abiertas en formato mobile-first.
- Puede entrar a una campaña y cargar/editar su intención de compra.
- Puede ver, modificar y eliminar sus intenciones (mientras la campaña esté ABIERTA).
- El volumen acumulado se actualiza en tiempo real via Socket.io.
- Bloqueo automático de edición N horas antes del cierre (`horasLockoutEdicion`).

---

## Prerrequisitos

- Fase 4 completa. Campañas funcionando.
- Socket.io activado en `server.js`.

---

## Tareas

### 1. Schema Prisma

Agregar modelo `IntencionCompra`. Migrar:

```bash
npx prisma migrate dev --name add_intenciones
```

### 2. Módulo `intenciones`

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

  const intencion = await prisma.intencionCompra.create({
    data: {
      campanaId: datos.campanaId,
      productorId: productor.id,
      volumen: datos.volumen,
      observaciones: datos.observaciones,
      modalidadEntregaPreferida: datos.modalidadEntregaPreferida,
      depositoPreferidoId: datos.depositoPreferidoId
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
      modalidadEntregaPreferida: datos.modalidadEntregaPreferida,
      depositoPreferidoId: datos.depositoPreferidoId
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
  modalidadEntregaPreferida: z.enum(['RETIRO_EN_DEPOSITO', 'ENTREGA_EN_CAMPO']).optional(),
  depositoPreferidoId: z.number().int().positive().optional()
});

export const actualizarIntencionSchema = crearIntencionSchema.partial().omit({ campanaId: true });
```

### 3. Frontend: portal productor

```
frontend/src/features/intenciones/
├── api/intenciones.api.js
├── pages/
│   ├── MisIntencionesPage.jsx     # Listado de intenciones del productor
│   └── CargarIntencionPage.jsx    # Form para cargar/editar en una campaña
└── components/
    ├── IntencionForm.jsx           # Form principal
    └── IntencionCard.jsx           # Card de intención en listado
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
  modalidadEntregaPreferida: z.enum(['RETIRO_EN_DEPOSITO', 'ENTREGA_EN_CAMPO']).optional(),
  depositoPreferidoId: z.coerce.number().int().positive().optional()
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

### 4. Suscripción en tiempo real al detalle de campaña

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

### 5. Listeners de notificaciones (módulo `notificaciones`)

Crear `backend/src/modules/notificaciones/` con service básico (ver `04-NOTIFICACIONES.md`).

Registrar listeners en `server.js`:

```javascript
import { registrarListenersNotificaciones } from './modules/notificaciones/notificaciones.listeners.js';
registrarListenersNotificaciones();
```

En esta fase, los listeners ya empiezan a guardar notificaciones en BD aunque el frontend recién las muestre completamente en una iteración posterior. La campanita (`/api/notificaciones/no-leidas/count`) debe funcionar desde acá.

---

## Tests

- Productor aprobado carga intención → 201.
- Productor no aprobado intenta cargar → 403.
- Cargar intención en campaña no ABIERTA → 409.
- Editar intención dentro del lockout → 409.
- Editar intención fuera del lockout → 200.
- Eliminar intención propia → 204.
- Intentar editar intención de otro productor → 403.

---

## Checklist de cierre

- [ ] Migración `add_intenciones` aplicada.
- [ ] Endpoints `/api/intenciones/*` operativos.
- [ ] Form de carga mobile-first funcional (probarlo en celular o DevTools modo móvil).
- [ ] Volumen acumulado se actualiza en vivo cuando otro productor carga intención (Socket.io probado con 2 navegadores).
- [ ] Tabla `notificaciones` empieza a poblarse al ocurrir eventos.
- [ ] Coverage ≥ 60%.
- [ ] Tag: `v0.5-fase-5-intenciones`.

---

## Próximo paso

[`11-FASE-6-COTIZACIONES.md`](./11-FASE-6-COTIZACIONES.md)
