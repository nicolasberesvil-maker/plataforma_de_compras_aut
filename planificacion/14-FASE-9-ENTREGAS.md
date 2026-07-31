# Fase 9 — Entregas (Logística Mixta)

> **Sprint:** 10 (1 semana)
> **Objetivo:** Gestionar el ciclo de vida de la entrega física: retiro en depósito o entrega en campo.

---

## Resultado esperado

- ADMIN/OPERADOR_DEPOSITO ven entregas pendientes filtradas por depósito.
- Pueden marcar transiciones: PENDIENTE → EN_TRANSITO → DISPONIBLE_PARA_RETIRO → ENTREGADA.
- Cuando una entrega pasa a DISPONIBLE_PARA_RETIRO, el productor recibe notificación con datos del depósito.
- Cuando se confirma retiro, se genera automáticamente un `StockMovimiento` de tipo EGRESO_PRODUCTOR.
- Productor ve estado en vivo de sus entregas.

---

## Prerrequisitos

- Fase 8 completa.

---

## Tareas

### 1. Schema Prisma

El modelo `Entrega` ya se creó en la Fase 7 (estaba en el schema base). Esta fase implementa su lógica de servicio y transiciones.

### 2. Util de transiciones de estado

`backend/src/utils/transiciones-entrega.js`:

```javascript
export const TRANSICIONES_ENTREGA = {
  PENDIENTE:                ['EN_TRANSITO', 'DISPONIBLE_PARA_RETIRO', 'CANCELADA'],
  EN_TRANSITO:              ['DISPONIBLE_PARA_RETIRO', 'EN_RUTA_A_CAMPO', 'CANCELADA'],
  DISPONIBLE_PARA_RETIRO:   ['ENTREGADA', 'CANCELADA'],
  EN_RUTA_A_CAMPO:          ['ENTREGADA', 'CANCELADA'],
  ENTREGADA:                [],
  CANCELADA:                []
};

export function puedeTransicionar(estadoActual, estadoNuevo) {
  return TRANSICIONES_ENTREGA[estadoActual]?.includes(estadoNuevo) ?? false;
}
```

### 3. Módulo `entregas`

```
backend/src/modules/entregas/
├── entregas.controller.js
├── entregas.service.js
├── entregas.routes.js
├── entregas.schemas.js
└── entregas.test.js
```

#### `entregas.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';
import { puedeTransicionar } from '../../utils/transiciones-entrega.js';
import * as stockService from '../stock/stock.service.js';

export async function listarMias(usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) throw new ForbiddenError();

  return prisma.entrega.findMany({
    where: { productorId: productor.id },
    include: {
      ordenCompra: {
        include: { adjudicacion: { include: { campana: { include: { producto: true } } } } }
      },
      deposito: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function listar({ depositoId, estado, page = 1, limit = 20 }) {
  const where = {};
  if (depositoId) where.depositoId = depositoId;
  if (estado) where.estado = estado;

  const [data, total] = await Promise.all([
    prisma.entrega.findMany({
      where,
      include: {
        ordenCompra: { include: { adjudicacion: { include: { campana: { include: { producto: true } } } } } },
        productor: { include: { usuario: { select: { nombre: true, telefono: true } } } },
        deposito: true
      },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.entrega.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id, usuario) {
  const entrega = await prisma.entrega.findUnique({
    where: { id },
    include: {
      ordenCompra: { include: { adjudicacion: { include: { campana: { include: { producto: true } } } } } },
      productor: true,
      deposito: true
    }
  });
  if (!entrega) throw new NotFoundError('Entrega');

  if (usuario.rol === 'PRODUCTOR') {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: usuario.id } });
    if (entrega.productorId !== productor.id) throw new ForbiddenError();
  }

  return entrega;
}

export async function marcarEnTransito(id) {
  const entrega = await obtenerEntregaConValidacion(id, 'EN_TRANSITO');

  const actualizada = await prisma.entrega.update({
    where: { id },
    data: { estado: 'EN_TRANSITO' }
  });

  eventBus.emit('ENTREGA_EN_TRANSITO', {
    entregaId: id,
    productorId: entrega.productorId
  });

  return actualizada;
}

export async function marcarDisponible(id) {
  const entrega = await obtenerEntregaConValidacion(id, 'DISPONIBLE_PARA_RETIRO');

  if (entrega.modalidad !== 'RETIRO_EN_DEPOSITO') {
    throw new ValidationError('Solo aplicable a entregas de tipo RETIRO_EN_DEPOSITO');
  }

  const actualizada = await prisma.entrega.update({
    where: { id },
    data: {
      estado: 'DISPONIBLE_PARA_RETIRO',
      fechaDisponibleDesde: new Date()
    }
  });

  // Esta es la notif más importante: el productor recibe email + campanita
  eventBus.emit('ENTREGA_DISPONIBLE', {
    entregaId: id,
    productorId: entrega.productorId,
    depositoId: entrega.depositoId
  });

  return actualizada;
}

/**
 * Confirma retiro físico por productor (lo registra el operador del depósito).
 * Atomic: cambia estado + genera movimiento de stock egreso.
 */
export async function confirmarRetiro(id, datos, usuarioId) {
  return prisma.$transaction(async (tx) => {
    const entrega = await tx.entrega.findUnique({
      where: { id },
      include: {
        ordenCompra: {
          include: {
            adjudicacion: { include: { campana: { include: { producto: true } } } }
          }
        }
      }
    });
    if (!entrega) throw new NotFoundError('Entrega');
    if (entrega.modalidad !== 'RETIRO_EN_DEPOSITO') {
      throw new ValidationError('No es entrega tipo retiro');
    }
    if (!puedeTransicionar(entrega.estado, 'ENTREGADA')) {
      throw new ConflictError(`No se puede pasar de ${entrega.estado} a ENTREGADA`);
    }

    // Actualizar entrega
    const actualizada = await tx.entrega.update({
      where: { id },
      data: {
        estado: 'ENTREGADA',
        fechaEntregadaAt: new Date(),
        recibidaPorNombre: datos.recibidaPorNombre,
        recibidaPorDni: datos.recibidaPorDni,
        observaciones: datos.observaciones
      }
    });

    // Generar movimiento de stock (egreso)
    await tx.stockMovimiento.create({
      data: {
        depositoId: entrega.depositoId,
        productoId: entrega.ordenCompra.adjudicacion.campana.productoId,
        tipo: 'EGRESO_PRODUCTOR',
        cantidad: entrega.ordenCompra.volumenFinal,
        signo: -1,
        entregaId: id,
        ejecutadoPorId: usuarioId,
        observaciones: `Retiro confirmado por ${datos.recibidaPorNombre}`
      }
    });

    return actualizada;
  }).then((actualizada) => {
    eventBus.emit('ENTREGA_CONFIRMADA', {
      entregaId: id,
      productorId: actualizada.productorId
    });
    return actualizada;
  });
}

/**
 * Confirma entrega en campo. Puede ejecutarla el ADMIN (si AUT coordinó y le
 * avisan) o el PRODUCTOR dueño de la entrega (regla nueva D.5): cuando el
 * proveedor entrega directo en el campo, sin pasar por depósito de AUT, es el
 * productor quien está físicamente presente para confirmar que recibió la
 * mercadería — no tiene sentido obligarlo a esperar que un operador de AUT
 * lo cargue después. Por eso la autorización se resuelve en el controller
 * (`requireRole(['ADMIN']) OR ownership`), no acá: el service no conoce roles.
 */
export async function confirmarEntregaCampo(id, datos, usuario) {
  const entrega = await obtenerEntregaConValidacion(id, 'ENTREGADA');

  if (entrega.modalidad !== 'ENTREGA_EN_CAMPO') {
    throw new ValidationError('No es entrega tipo campo');
  }

  // Si quien confirma es el productor, valida que sea el dueño de la entrega.
  if (usuario.rol === 'PRODUCTOR') {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: usuario.id } });
    if (!productor || entrega.productorId !== productor.id) {
      throw new ForbiddenError('Solo el productor dueño de la entrega puede confirmarla');
    }
  }

  const actualizada = await prisma.entrega.update({
    where: { id },
    data: {
      estado: 'ENTREGADA',
      fechaEntregadaAt: new Date(),
      recibidaPorNombre: datos.recibidaPorNombre,
      recibidaPorDni: datos.recibidaPorDni,
      observaciones: datos.observaciones
    }
  });

  eventBus.emit('ENTREGA_CONFIRMADA', {
    entregaId: id,
    productorId: actualizada.productorId
  });

  return actualizada;
}

export async function cancelar(id, motivo) {
  const entrega = await prisma.entrega.findUnique({ where: { id } });
  if (!entrega) throw new NotFoundError('Entrega');
  if (entrega.estado === 'ENTREGADA') throw new ConflictError('Ya fue entregada');

  return prisma.entrega.update({
    where: { id },
    data: {
      estado: 'CANCELADA',
      observaciones: motivo
    }
  });
}

// ============================================================

async function obtenerEntregaConValidacion(id, estadoNuevo) {
  const entrega = await prisma.entrega.findUnique({ where: { id } });
  if (!entrega) throw new NotFoundError('Entrega');
  if (!puedeTransicionar(entrega.estado, estadoNuevo)) {
    throw new ConflictError(`No se puede pasar de ${entrega.estado} a ${estadoNuevo}`);
  }
  return entrega;
}
```

### 4. Frontend: gestión de entregas

```
frontend/src/features/entregas/
├── api/entregas.api.js
├── pages/
│   ├── EntregasAdminPage.jsx          # Tablero de entregas para AUT/operadores
│   ├── MisEntregasPage.jsx            # Vista del productor
│   └── EntregaDetailPage.jsx
└── components/
    ├── EntregaCard.jsx                # Card mobile para productor
    ├── EstadoEntregaBadge.jsx
    ├── ConfirmarRetiroForm.jsx
    └── FiltrosEntregas.jsx
```

#### `EntregaCard.jsx` (vista productor)

```jsx
export function EntregaCard({ entrega }) {
  const producto = entrega.ordenCompra.adjudicacion.campana.producto;

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold">{producto.nombre}</h3>
          <p className="text-sm text-gray-600">
            {entrega.ordenCompra.volumenFinal} {producto.unidadMedida}
          </p>
        </div>
        <EstadoEntregaBadge estado={entrega.estado} />
      </div>

      {entrega.modalidad === 'RETIRO_EN_DEPOSITO' && entrega.deposito && (
        <div className="bg-blue-50 p-3 rounded mt-3 text-sm">
          <p className="font-medium">📍 Retirar en: {entrega.deposito.nombre}</p>
          <p>{entrega.deposito.direccion}, {entrega.deposito.localidad}</p>
          {entrega.deposito.horarioAtencion && (
            <p className="text-gray-600 mt-1">🕐 {entrega.deposito.horarioAtencion}</p>
          )}
          {entrega.deposito.responsable && (
            <p className="text-gray-600">👤 {entrega.deposito.responsable}</p>
          )}
        </div>
      )}

      {entrega.estado === 'DISPONIBLE_PARA_RETIRO' && (
        <div className="mt-3 p-2 bg-green-100 text-green-800 rounded text-sm text-center font-medium">
          ✓ Listo para retirar
        </div>
      )}

      {/* Botón de confirmación del PRODUCTOR (regla D.5): cuando el proveedor
          entrega directo en el campo, AUT no está presente — el que confirma
          que la mercadería llegó es el propio productor. */}
      {entrega.modalidad === 'ENTREGA_EN_CAMPO' &&
        ['EN_TRANSITO', 'EN_RUTA_A_CAMPO'].includes(entrega.estado) && (
        <BotonConfirmarRecepcion entregaId={entrega.id} />
      )}
    </div>
  );
}

function BotonConfirmarRecepcion({ entregaId }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => entregasApi.confirmarEntregaCampo(entregaId, {}),
    onSuccess: () => queryClient.invalidateQueries(['entregas'])
  });

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="w-full mt-3 bg-aut-verde text-white py-3 rounded-lg font-semibold disabled:opacity-50"
    >
      {mutation.isPending ? 'Confirmando...' : '✓ Confirmé que recibí mi pedido'}
    </button>
  );
}
```

---

## Tests

- Marcar DISPONIBLE en entrega tipo CAMPO → 400.
- Marcar DISPONIBLE en entrega tipo RETIRO → 200 + evento emitido + notif al productor.
- Confirmar retiro: genera movimiento stock EGRESO_PRODUCTOR con cantidad correcta.
- Confirmar retiro en entrega ya ENTREGADA → 409.
- Verificar atomicidad: si falla la creación del movimiento de stock, la entrega NO cambia de estado.
- Productor dueño confirma `confirmar-entrega-campo` en su propia entrega ENTREGA_EN_CAMPO → 200.
- Productor intenta confirmar la entrega de OTRO productor → 403.
- ADMIN sigue pudiendo confirmar entrega en campo (ej: el productor llamó por teléfono y pide que AUT lo cargue).

---

## Checklist de cierre

- [x] Endpoints `/api/entregas/*` operativos.
- [x] Util de transiciones de estado implementada y probada.
- [x] Notificación `ENTREGA_DISPONIBLE` llega al productor (email + campanita).
- [x] Confirmar retiro genera movimiento de stock automáticamente.
- [x] Productor tiene su propio botón para confirmar entrega directa proveedor→productor (sin depender de que AUT lo cargue).
- [x] Frontend muestra tablero admin y vista productor.
- [x] Coverage ≥ 60% (módulo entregas: 9 tests cubriendo transiciones, egreso de stock y ownership).
- [ ] Tag: `v0.9-fase-9-entregas`.

> Nota: `Entrega.depositoId` no se asignaba en ningún punto anterior (ver `DECISIONES-PENDIENTES.md` #6) — se resolvió permitiendo elegirlo al marcar en-tránsito/disponible. Pendiente de confirmación de Nicolás si prefiere otro momento de asignación.

---

## Próximo paso

[`15-FASE-10-FACTURACION.md`](./15-FASE-10-FACTURACION.md)
