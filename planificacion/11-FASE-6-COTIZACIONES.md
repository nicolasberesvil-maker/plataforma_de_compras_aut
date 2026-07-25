# Fase 6 — Cotizaciones (Portal Proveedor)

> **Sprint:** 7 (1 semana)
> **Objetivo:** Que el proveedor pueda ver campañas en licitación y subir su cotización en sobre cerrado.

---

## Resultado esperado

- Proveedor logueado ve las campañas en estado EN_LICITACION (sin ver intenciones individuales).
- Solo ve el volumen consolidado, el producto y las condiciones requeridas.
- Carga cotización con precio, plazo, condiciones, validez.
- Puede editar su cotización mientras la campaña esté en licitación.
- NO ve cotizaciones de otros proveedores (sobre cerrado, regla C.6).

---

## Prerrequisitos

- Fase 5 completa. Eventos funcionando.

---

## Tareas

### 1. Schema Prisma

Agregar modelo `Cotizacion` y enum `Moneda`. Migrar:

```bash
npx prisma migrate dev --name add_cotizaciones
```

### 2. Módulo `cotizaciones`

```
backend/src/modules/cotizaciones/
├── cotizaciones.controller.js
├── cotizaciones.service.js
├── cotizaciones.routes.js
├── cotizaciones.schemas.js
└── cotizaciones.test.js
```

#### `cotizaciones.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';

export async function listarMias(usuarioId) {
  const proveedor = await obtenerProveedorDelUsuario(usuarioId);

  return prisma.cotizacion.findMany({
    where: { proveedorId: proveedor.id },
    include: {
      campana: { include: { producto: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Lista campañas en EN_LICITACION para el proveedor.
 * Incluye solo info pública: producto, volumen consolidado, fecha límite, condiciones.
 * NO incluye intenciones individuales (regla C.6).
 */
export async function listarCampanasParaCotizar(usuarioId) {
  const proveedor = await obtenerProveedorDelUsuario(usuarioId);
  if (proveedor.estadoAprobacion !== 'APROBADO') {
    throw new ForbiddenError('Proveedor no aprobado');
  }

  const campanas = await prisma.campana.findMany({
    where: {
      estado: 'EN_LICITACION',
      fechaCierreCotizaciones: { gt: new Date() }
    },
    include: { producto: true }
  });

  // Enriquecer con volumen consolidado y si ya cotizó
  const resultado = await Promise.all(campanas.map(async (campana) => {
    const stats = await prisma.intencionCompra.aggregate({
      where: { campanaId: campana.id },
      _sum: { volumen: true },
      _count: true
    });

    const miCotizacion = await prisma.cotizacion.findUnique({
      where: { campanaId_proveedorId: { campanaId: campana.id, proveedorId: proveedor.id } }
    });

    return {
      id: campana.id,
      nombre: campana.nombre,
      descripcion: campana.descripcion,
      producto: campana.producto,
      volumenConsolidado: Number(stats._sum.volumen ?? 0),
      cantidadProductores: stats._count,
      fechaCierreCotizaciones: campana.fechaCierreCotizaciones,
      yaCotice: !!miCotizacion,
      miCotizacion: miCotizacion || null
    };
  }));

  return resultado;
}

export async function obtenerPorId(id, usuario) {
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    include: { campana: { include: { producto: true } }, proveedor: true }
  });
  if (!cotizacion) throw new NotFoundError('Cotización');

  // Solo ve su cotización o admin la ve toda
  if (usuario.rol === 'PROVEEDOR') {
    const proveedor = await obtenerProveedorDelUsuario(usuario.id);
    if (cotizacion.proveedorId !== proveedor.id) throw new ForbiddenError();
  }

  return cotizacion;
}

export async function crear(datos, usuarioId) {
  const proveedor = await obtenerProveedorDelUsuario(usuarioId);
  if (proveedor.estadoAprobacion !== 'APROBADO') {
    throw new ForbiddenError('Proveedor no aprobado');
  }

  const campana = await prisma.campana.findUnique({ where: { id: datos.campanaId } });
  if (!campana) throw new NotFoundError('Campaña');
  if (campana.estado !== 'EN_LICITACION') {
    throw new ConflictError('La campaña no está en licitación');
  }
  if (campana.fechaCierreCotizaciones && new Date() > campana.fechaCierreCotizaciones) {
    throw new ConflictError('El plazo para cotizar venció');
  }

  // Validar única por proveedor+campaña
  const existente = await prisma.cotizacion.findUnique({
    where: { campanaId_proveedorId: { campanaId: campana.id, proveedorId: proveedor.id } }
  });
  if (existente) throw new ConflictError('Ya cotizaste esta campaña. Editá la existente.');

  const cotizacion = await prisma.cotizacion.create({
    data: { ...datos, proveedorId: proveedor.id },
    include: { campana: { include: { producto: true } } }
  });

  eventBus.emit('COTIZACION_RECIBIDA', {
    cotizacionId: cotizacion.id,
    campanaId: campana.id,
    proveedorId: proveedor.id
  });

  return cotizacion;
}

export async function actualizar(id, datos, usuarioId) {
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    include: { campana: true }
  });
  if (!cotizacion) throw new NotFoundError('Cotización');

  const proveedor = await obtenerProveedorDelUsuario(usuarioId);
  if (cotizacion.proveedorId !== proveedor.id) throw new ForbiddenError();

  if (cotizacion.campana.estado !== 'EN_LICITACION') {
    throw new ConflictError('La campaña ya no está en licitación');
  }

  return prisma.cotizacion.update({
    where: { id },
    data: {
      precioUnitario: datos.precioUnitario,
      monedaPrecio: datos.monedaPrecio,
      plazoEntregaDias: datos.plazoEntregaDias,
      condicionesPago: datos.condicionesPago,
      observaciones: datos.observaciones,
      validaHasta: datos.validaHasta
    },
    include: { campana: { include: { producto: true } } }
  });
}

export async function eliminar(id, usuarioId) {
  const cotizacion = await obtenerPorId(id, { id: usuarioId, rol: 'PROVEEDOR' });
  if (cotizacion.campana.estado !== 'EN_LICITACION') {
    throw new ConflictError('No se puede retirar una cotización ya cerrada');
  }
  await prisma.cotizacion.delete({ where: { id } });
}

// ============================================================

async function obtenerProveedorDelUsuario(usuarioId) {
  const proveedor = await prisma.proveedor.findUnique({ where: { usuarioId } });
  if (!proveedor) throw new ForbiddenError('Usuario no es proveedor');
  return proveedor;
}
```

#### `cotizaciones.schemas.js`

```javascript
import { z } from 'zod';

export const crearCotizacionSchema = z.object({
  campanaId: z.number().int().positive(),
  precioUnitario: z.number().positive(),
  monedaPrecio: z.enum(['ARS', 'USD']).default('ARS'),
  plazoEntregaDias: z.number().int().positive(),
  condicionesPago: z.string().min(5).max(2000),
  observaciones: z.string().max(2000).optional(),
  validaHasta: z.coerce.date()
});

export const actualizarCotizacionSchema = crearCotizacionSchema.partial().omit({ campanaId: true });
```

### 3. Listener para notificar a proveedores cuando se abre RFQ

En `notificaciones.listeners.js`:

```javascript
eventBus.on('RFQ_ABIERTO', async ({ campanaId, volumenConsolidado }) => {
  try {
    // Notificar a TODOS los proveedores aprobados
    const proveedores = await prisma.proveedor.findMany({
      where: { estadoAprobacion: 'APROBADO' },
      include: { usuario: true }
    });

    const campana = await prisma.campana.findUnique({
      where: { id: campanaId },
      include: { producto: true }
    });

    for (const prov of proveedores) {
      await notificacionService.crearYEnviar({
        usuarioId: prov.usuarioId,
        tipo: 'RFQ_RECIBIDO',
        titulo: 'Nueva licitación disponible',
        mensaje: `Hay una nueva campaña para cotizar: ${campana.producto.nombre}. Volumen: ${volumenConsolidado} ${campana.producto.unidadMedida}.`,
        enlaceRelativo: `/proveedor/campanas/${campanaId}`,
        metadatos: { campanaId, volumenConsolidado }
      });
    }
  } catch (err) {
    logger.error({ err, event: 'RFQ_ABIERTO' }, 'Error notificando proveedores');
  }
});
```

### 4. Frontend: portal proveedor

```
frontend/src/features/cotizaciones/
├── api/cotizaciones.api.js
├── pages/
│   ├── CampanasParaCotizarPage.jsx   # Listado de campañas disponibles
│   ├── CotizacionFormPage.jsx        # Form crear/editar
│   └── MisCotizacionesPage.jsx       # Historial
└── components/
    ├── CampanaCotizableCard.jsx
    └── CotizacionForm.jsx
```

#### `CotizacionForm.jsx`

```jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';

const schema = z.object({
  precioUnitario: z.coerce.number().positive(),
  monedaPrecio: z.enum(['ARS', 'USD']),
  plazoEntregaDias: z.coerce.number().int().positive(),
  condicionesPago: z.string().min(5),
  observaciones: z.string().optional(),
  validaHasta: z.string()
});

export function CotizacionForm({ campana, cotizacionExistente, onSuccess }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: cotizacionExistente || { monedaPrecio: 'ARS' }
  });

  const mutation = useMutation({
    mutationFn: (data) => cotizacionExistente
      ? cotizacionesApi.actualizar(cotizacionExistente.id, data)
      : cotizacionesApi.crear({ ...data, campanaId: campana.id }),
    onSuccess
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold">{campana.producto.nombre}</h3>
        <p className="text-sm">Volumen consolidado: <strong>{campana.volumenConsolidado} {campana.producto.unidadMedida}</strong></p>
        <p className="text-sm">Productores agrupados: {campana.cantidadProductores}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label>Precio unitario</label>
          <input {...register('precioUnitario')} type="number" step="0.0001" className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label>Moneda</label>
          <select {...register('monedaPrecio')} className="w-full px-3 py-2 border rounded">
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div>
        <label>Plazo entrega (días)</label>
        <input {...register('plazoEntregaDias')} type="number" className="w-full px-3 py-2 border rounded" />
      </div>

      <div>
        <label>Condiciones de pago</label>
        <textarea {...register('condicionesPago')} rows={3} className="w-full px-3 py-2 border rounded"
                  placeholder="Ej: 30 días contra factura, sin anticipo" />
      </div>

      <div>
        <label>Válida hasta</label>
        <input {...register('validaHasta')} type="date" className="w-full px-3 py-2 border rounded" />
      </div>

      <div>
        <label>Observaciones (opcional)</label>
        <textarea {...register('observaciones')} rows={2} className="w-full px-3 py-2 border rounded" />
      </div>

      <button type="submit" disabled={mutation.isPending}
              className="w-full bg-aut-verde text-white py-3 rounded-lg font-medium">
        {cotizacionExistente ? 'Actualizar cotización' : 'Enviar cotización'}
      </button>
    </form>
  );
}
```

---

## Tests

- Proveedor aprobado lista campañas EN_LICITACION → ve volumen consolidado, NO ve intenciones individuales.
- Proveedor no aprobado → 403.
- Crear cotización en campaña no en licitación → 409.
- Crear cotización después del plazo de cotización → 409.
- Crear segunda cotización (mismo proveedor, misma campaña) → 409.
- Proveedor A intenta ver cotización de Proveedor B → 403.
- Listener `RFQ_ABIERTO` genera notificaciones para todos los proveedores aprobados.

---

## Checklist de cierre

- [ ] Migración `add_cotizaciones` aplicada.
- [ ] Endpoints `/api/cotizaciones/*` operativos.
- [ ] Portal proveedor visible y funcional.
- [ ] Notificación `RFQ_RECIBIDO` llega a proveedores al cerrarse intenciones.
- [ ] Coverage ≥ 60%.
- [ ] Tag: `v0.6-fase-6-cotizaciones`.

---

## Próximo paso

[`12-FASE-7-ADJUDICACION.md`](./12-FASE-7-ADJUDICACION.md)
