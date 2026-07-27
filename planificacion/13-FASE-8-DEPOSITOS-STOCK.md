# Fase 8 — Depósitos y Stock (libro append-only)

> **Sprint:** 9 (1 semana)
> **Objetivo:** Gestionar los múltiples galpones de AUT (Franck, Progreso, Colonia Nueva, etc.) y el stock de cada uno con auditabilidad fiscal completa.

---

## Resultado esperado

- ADMIN da de alta depósitos con localidad, dirección, responsable.
- ADMIN registra ingresos de mercadería (proveedor entregó al galpón).
- ADMIN realiza ajustes de stock (conteo físico).
- ADMIN realiza transferencias entre depósitos.
- Se puede consultar stock actual por depósito y por producto.
- TODO movimiento queda persistido (append-only) con quien lo ejecutó, fecha y razón.
- ADMIN/CONTADOR/productor puede consultar la **cuenta corriente de un productor**: cuánto compró, cuánto ya se le entregó, cuánto le falta entregar y cuánto adeuda.

---

## Prerrequisitos

- Fase 7 completa.

---

## Decisión clave: stock como libro append-only

**NO se modela como un campo `stockActual: int` mutable.**

Razón (justificada en `02-MODELO-DATOS.md`):
1. Trazabilidad fiscal: reconstruir saldos a cualquier fecha pasada.
2. Sin race conditions en operaciones concurrentes.
3. Detectabilidad de errores: si hay desfase, sabés cuándo se introdujo.

El stock actual es **siempre una agregación**: `SUM(cantidad * signo)`.

---

## Tareas

### 1. Schema Prisma

Agregar modelos `Deposito`, `StockMovimiento` y el enum `TipoMovimientoStock`. Migrar:

```bash
npx prisma migrate dev --name add_depositos_stock
```

### 2. Módulo `depositos`

```
backend/src/modules/depositos/
├── depositos.controller.js
├── depositos.service.js
├── depositos.routes.js
├── depositos.schemas.js
└── depositos.test.js
```

#### `depositos.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

export async function listar({ activo = true } = {}) {
  return prisma.deposito.findMany({
    where: { activo },
    orderBy: { nombre: 'asc' }
  });
}

export async function obtenerPorId(id) {
  const deposito = await prisma.deposito.findUnique({ where: { id } });
  if (!deposito) throw new NotFoundError('Depósito');
  return deposito;
}

export async function crear(datos) {
  return prisma.deposito.create({ data: datos });
}

export async function actualizar(id, datos) {
  await obtenerPorId(id);
  return prisma.deposito.update({ where: { id }, data: datos });
}

export async function desactivar(id) {
  // NUNCA se borra: histórico fiscal
  const deposito = await obtenerPorId(id);

  // Validar que no haya entregas pendientes en este depósito
  const entregasActivas = await prisma.entrega.count({
    where: { depositoId: id, estado: { in: ['PENDIENTE', 'EN_TRANSITO', 'DISPONIBLE_PARA_RETIRO'] } }
  });
  if (entregasActivas > 0) {
    throw new ConflictError(`No se puede desactivar: hay ${entregasActivas} entregas activas`);
  }

  return prisma.deposito.update({ where: { id }, data: { activo: false } });
}

/**
 * Calcula stock actual por producto en un depósito.
 * Suma todos los movimientos: cantidad * signo.
 */
export async function obtenerStock(depositoId) {
  await obtenerPorId(depositoId);

  // Raw query porque Prisma no expone SUM con multiplicación de columnas directamente
  const movimientos = await prisma.stockMovimiento.groupBy({
    by: ['productoId'],
    where: { depositoId },
    _sum: { cantidad: true }
  });

  // Para cantidades correctas necesitamos considerar signo.
  // Hacemos el cálculo manual recorriendo agrupado por tipo:
  const detallado = await prisma.$queryRaw`
    SELECT producto_id AS productoId,
           SUM(cantidad * signo) AS stock
    FROM stock_movimientos
    WHERE deposito_id = ${depositoId}
    GROUP BY producto_id
  `;

  // Enriquecer con info de producto
  const productoIds = detallado.map(d => d.productoId);
  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds } }
  });

  return detallado.map(d => {
    const producto = productos.find(p => p.id === d.productoId);
    return {
      productoId: d.productoId,
      nombreProducto: producto?.nombre,
      unidadMedida: producto?.unidadMedida,
      stockActual: Number(d.stock)
    };
  });
}
```

### 3. Módulo `stock`

```
backend/src/modules/stock/
├── stock.controller.js
├── stock.service.js
├── stock.routes.js
├── stock.schemas.js
└── stock.test.js
```

#### `stock.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { ValidationError, ConflictError } from '../../utils/errors.js';

/**
 * Registra ingreso de mercadería al depósito.
 * Tipicamente tras llegada de proveedor adjudicado.
 */
export async function registrarIngreso(datos, usuarioId) {
  if (datos.cantidad <= 0) throw new ValidationError('Cantidad debe ser positiva');

  return prisma.stockMovimiento.create({
    data: {
      depositoId: datos.depositoId,
      productoId: datos.productoId,
      tipo: 'INGRESO_PROVEEDOR',
      cantidad: datos.cantidad,
      signo: 1,
      proveedorOrigen: datos.proveedorOrigen,
      observaciones: datos.observaciones,
      ejecutadoPorId: usuarioId
    }
  });
}

/**
 * Registra ajuste por conteo físico.
 * diferencia puede ser positiva (más stock real) o negativa (menos).
 */
export async function registrarAjuste(datos, usuarioId) {
  const { depositoId, productoId, diferencia, observaciones } = datos;

  if (diferencia === 0) throw new ValidationError('La diferencia no puede ser 0');
  if (!observaciones || observaciones.length < 10) {
    throw new ValidationError('El ajuste requiere observaciones (≥ 10 caracteres)');
  }

  const tipo = diferencia > 0 ? 'AJUSTE_INVENTARIO_POSITIVO' : 'AJUSTE_INVENTARIO_NEGATIVO';
  const signo = diferencia > 0 ? 1 : -1;

  return prisma.stockMovimiento.create({
    data: {
      depositoId,
      productoId,
      tipo,
      cantidad: Math.abs(diferencia),
      signo,
      observaciones,
      ejecutadoPorId: usuarioId
    }
  });
}

/**
 * Transferencia entre depósitos: genera DOS movimientos en transacción.
 */
export async function registrarTransferencia(datos, usuarioId) {
  const { depositoOrigenId, depositoDestinoId, productoId, cantidad, observaciones } = datos;

  if (depositoOrigenId === depositoDestinoId) {
    throw new ValidationError('Origen y destino no pueden ser iguales');
  }
  if (cantidad <= 0) throw new ValidationError('Cantidad debe ser positiva');

  return prisma.$transaction(async (tx) => {
    const salida = await tx.stockMovimiento.create({
      data: {
        depositoId: depositoOrigenId,
        productoId,
        tipo: 'TRANSFERENCIA_SALIDA',
        cantidad,
        signo: -1,
        observaciones: `Transferencia a depósito ${depositoDestinoId}. ${observaciones || ''}`,
        ejecutadoPorId: usuarioId
      }
    });

    const entrada = await tx.stockMovimiento.create({
      data: {
        depositoId: depositoDestinoId,
        productoId,
        tipo: 'TRANSFERENCIA_ENTRADA',
        cantidad,
        signo: 1,
        observaciones: `Transferencia desde depósito ${depositoOrigenId}. ${observaciones || ''}`,
        ejecutadoPorId: usuarioId
      }
    });

    return { salida, entrada };
  });
}

/**
 * Egreso por retiro de productor.
 * Llamado por el módulo Entregas cuando se confirma retiro.
 */
export async function registrarEgresoProductor({ depositoId, productoId, cantidad, entregaId }, usuarioId) {
  return prisma.stockMovimiento.create({
    data: {
      depositoId,
      productoId,
      tipo: 'EGRESO_PRODUCTOR',
      cantidad,
      signo: -1,
      entregaId,
      ejecutadoPorId: usuarioId
    }
  });
}

export async function listarMovimientos({ depositoId, productoId, desde, hasta, page = 1, limit = 50 }) {
  const where = {};
  if (depositoId) where.depositoId = depositoId;
  if (productoId) where.productoId = productoId;
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = new Date(desde);
    if (hasta) where.fecha.lte = new Date(hasta);
  }

  const [data, total] = await Promise.all([
    prisma.stockMovimiento.findMany({
      where,
      include: {
        deposito: { select: { nombre: true, localidad: true } },
        producto: { select: { nombre: true, unidadMedida: true } },
        ejecutadoPor: { select: { nombre: true, apellido: true } }
      },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { fecha: 'desc' }
    }),
    prisma.stockMovimiento.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
```

#### `stock.schemas.js`

```javascript
import { z } from 'zod';

export const ingresoSchema = z.object({
  depositoId: z.number().int().positive(),
  productoId: z.number().int().positive(),
  cantidad: z.number().positive(),
  proveedorOrigen: z.string().optional(),
  observaciones: z.string().optional()
});

export const ajusteSchema = z.object({
  depositoId: z.number().int().positive(),
  productoId: z.number().int().positive(),
  diferencia: z.number(),
  observaciones: z.string().min(10, 'Las observaciones son obligatorias para ajustes')
});

export const transferenciaSchema = z.object({
  depositoOrigenId: z.number().int().positive(),
  depositoDestinoId: z.number().int().positive(),
  productoId: z.number().int().positive(),
  cantidad: z.number().positive(),
  observaciones: z.string().optional()
});
```

### 4. Cuenta corriente por productor

> AUT recibe la mercadería adjudicada en su depósito y la entrega a medida que cada productor pasa a buscarla (o coordina la entrega en campo). Mientras tanto, alguien tiene que saber: ¿cuánto le debemos entregar todavía a este productor? ¿Cuánto nos tiene que pagar? Esto NO es una tabla nueva — es una vista agregada sobre `OrdenCompra` + `Entrega`, en el módulo `productores` (reutiliza datos ya existentes, no duplica estado).

```
backend/src/modules/productores/
└── productores.cuenta-corriente.js   # función agregada, se monta como sub-ruta de productores.routes.js
```

```javascript
import { prisma } from '../../config/database.js';

/**
 * Estado de cuenta consolidado de un productor: qué compró, qué ya se le
 * entregó y cuánto le falta, más el monto adeudado.
 *
 * Decisión de diseño: en v1 las órdenes son de "todo o nada" (no hay entregas
 * parciales de una misma OrdenCompra — ver 02-MODELO-DATOS.md). Por eso
 * "volumenEntregado" es simplemente volumenFinal cuando Entrega.estado =
 * ENTREGADA, y 0 en cualquier otro estado. Si en v2 se necesitan entregas
 * parciales, este es el único lugar que habría que tocar.
 */
export async function obtenerCuentaCorriente(productorId) {
  const ordenes = await prisma.ordenCompra.findMany({
    where: { productorId },
    include: {
      entrega: true,
      adjudicacion: { include: { campana: { include: { producto: true } } } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const porOrden = ordenes.map(o => {
    const entregado = o.entrega?.estado === 'ENTREGADA';
    const volumenEntregado = entregado ? Number(o.volumenFinal) : 0;

    return {
      ordenCompraId: o.id,
      producto: o.adjudicacion.campana.producto.nombre,
      volumenFinal: Number(o.volumenFinal),
      volumenEntregado,
      volumenPendiente: Number(o.volumenFinal) - volumenEntregado,
      estadoEntrega: o.entrega?.estado ?? 'PENDIENTE',
      montoTotal: Number(o.total),
      estadoPago: o.estadoPago
    };
  });

  const resumen = porOrden.reduce((acc, o) => ({
    totalOrdenado: acc.totalOrdenado + o.montoTotal,
    totalEntregado: acc.totalEntregado + (o.volumenPendiente === 0 ? o.montoTotal : 0),
    totalPendienteEntrega: acc.totalPendienteEntrega + (o.volumenPendiente > 0 ? o.montoTotal : 0),
    montoTotalAdeudado: acc.montoTotalAdeudado + (o.estadoPago !== 'PAGADO' ? o.montoTotal : 0)
  }), { totalOrdenado: 0, totalEntregado: 0, totalPendienteEntrega: 0, montoTotalAdeudado: 0 });

  return { productorId, resumen, porOrden };
}
```

Ruta (en `productores.routes.js`, roles `ADMIN`, `CONTADOR`, o el propio productor):

```javascript
router.get('/:id/cuenta-corriente',
  requireRoleOrOwner(['ADMIN', 'CONTADOR'], 'productor'),
  ctrl.obtenerCuentaCorriente
);
```

### 5. Frontend: gestión de depósitos y stock (admin)

```
frontend/src/features/depositos/
├── api/depositos.api.js
├── api/stock.api.js
├── pages/
│   ├── DepositosListPage.jsx
│   ├── DepositoFormPage.jsx
│   ├── DepositoDetailPage.jsx           # Stock actual + últimos movimientos
│   └── MovimientosStockPage.jsx          # Historial filtrable
└── components/
    ├── DepositoCard.jsx
    ├── StockTable.jsx                    # Stock actual del depósito
    ├── RegistrarIngresoForm.jsx
    ├── RegistrarAjusteForm.jsx
    └── RegistrarTransferenciaForm.jsx
```

#### `StockTable.jsx`

```jsx
export function StockTable({ stock }) {
  return (
    <table className="w-full border">
      <thead className="bg-gray-100">
        <tr>
          <th className="p-2 text-left">Producto</th>
          <th className="p-2 text-right">Stock actual</th>
          <th className="p-2 text-left">Unidad</th>
          <th className="p-2 text-right">Última actualización</th>
        </tr>
      </thead>
      <tbody>
        {stock.map(s => (
          <tr key={s.productoId} className={s.stockActual <= 0 ? 'text-red-600' : ''}>
            <td className="p-2">{s.nombreProducto}</td>
            <td className="p-2 text-right font-semibold">{s.stockActual.toLocaleString('es-AR')}</td>
            <td className="p-2">{s.unidadMedida}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

#### Seed de depósitos iniciales

Agregar a `seed.js`:

```javascript
const depositosIniciales = [
  { nombre: 'Galpón Central Franck', localidad: 'Franck', direccion: 'Av. Belgrano 1450', activo: true },
  { nombre: 'Depósito Progreso', localidad: 'Progreso', direccion: 'Por confirmar', activo: true },
  { nombre: 'Depósito Colonia Nueva', localidad: 'Colonia Nueva', direccion: 'Por confirmar', activo: true }
];

for (const d of depositosIniciales) {
  await prisma.deposito.upsert({
    where: { nombre: d.nombre },
    update: {},
    create: d
  });
}
```

**Nota crítica:** la lista real de depósitos debe ser confirmada por AUT antes del primer deploy. Estos valores son un placeholder.

---

## Tests

- Crear depósito → OK.
- Desactivar depósito con entregas activas → 409.
- Registrar ingreso suma al stock.
- Ajuste positivo y negativo modifican el stock correctamente.
- Transferencia entre depósitos: dos movimientos en transacción.
- Si una transferencia falla a mitad → rollback completo (verificar con error forzado).
- Cálculo de stock con múltiples movimientos da el saldo correcto.
- Auditoría: cada movimiento queda con `ejecutadoPorId` registrado.

---

## Checklist de cierre

- [ ] Migración `add_depositos_stock` aplicada.
- [ ] Endpoints `/api/depositos/*` y `/api/stock-movimientos/*` operativos.
- [ ] Endpoint `/api/productores/:id/cuenta-corriente` devuelve totales consistentes con las órdenes y entregas reales.
- [ ] Seed con depósitos iniciales (a confirmar lista real con AUT).
- [ ] Frontend permite ver stock por depósito y registrar movimientos.
- [ ] Coverage ≥ 60%.
- [ ] Tag: `v0.8-fase-8-depositos-stock`.

---

## Próximo paso

[`14-FASE-9-ENTREGAS.md`](./14-FASE-9-ENTREGAS.md)
