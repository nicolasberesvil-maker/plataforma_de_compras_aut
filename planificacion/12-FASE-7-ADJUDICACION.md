# Fase 7 — Adjudicación y Órdenes de Compra

> **Sprint:** 8 (1.5 semanas)
> **Objetivo:** Cerrar el flujo de compra. AUT compara cotizaciones, elige ganador, y se generan automáticamente las órdenes de compra individuales.

---

## Resultado esperado

- ADMIN ve un comparador de cotizaciones de una campaña (precio, plazo, condiciones, ranking del proveedor).
- ADMIN adjudica eligiendo una cotización ganadora.
- La adjudicación dispara una transacción:
  1. Crea registro `Adjudicacion`.
  2. Crea una `OrdenCompra` por cada intención válida del productor.
  3. Crea una `Entrega` (PENDIENTE) por cada orden.
  4. Marca la cotización ganadora con `esGanadora=true`.
  5. Emite eventos para notificaciones (productores, proveedor ganador, proveedores no elegidos).
- Productor ve su(s) orden(es) generada(s) en "Mis órdenes".

---

## Prerrequisitos

- Fase 6 completa.

---

## Tareas

### 1. Schema Prisma

Agregar modelos `Adjudicacion` y `OrdenCompra`. Migrar:

```bash
npx prisma migrate dev --name add_adjudicaciones
```

### 2. Módulo `adjudicaciones`

```
backend/src/modules/adjudicaciones/
├── adjudicaciones.controller.js
├── adjudicaciones.service.js
├── adjudicaciones.routes.js
├── adjudicaciones.schemas.js
└── adjudicaciones.test.js
```

#### `adjudicaciones.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';

/**
 * Devuelve el comparador de cotizaciones para una campaña.
 * Incluye ranking histórico de cada proveedor.
 */
export async function obtenerComparador(campanaId) {
  const campana = await prisma.campana.findUnique({
    where: { id: campanaId },
    include: { producto: true }
  });
  if (!campana) throw new NotFoundError('Campaña');
  if (campana.estado !== 'EN_LICITACION') {
    throw new ConflictError('La campaña no está en licitación');
  }

  const cotizaciones = await prisma.cotizacion.findMany({
    where: { campanaId },
    include: { proveedor: { include: { usuario: { select: { nombre: true, email: true } } } } }
  });

  // Calcular stats agregadas para ranking de cada proveedor
  const proveedorIds = cotizaciones.map(c => c.proveedorId);
  const historicos = await prisma.adjudicacion.groupBy({
    by: ['cotizacionGanadoraId'],
    where: { cotizacionGanadora: { proveedorId: { in: proveedorIds } } },
    _count: true
  });

  // ... (enriquecer con: # de campañas ganadas, etc.)

  const stats = await prisma.intencionCompra.aggregate({
    where: { campanaId },
    _sum: { volumen: true },
    _count: true
  });

  return {
    campana: {
      id: campana.id,
      nombre: campana.nombre,
      producto: campana.producto,
      volumenConsolidado: Number(stats._sum.volumen ?? 0),
      cantidadProductores: stats._count
    },
    cotizaciones: cotizaciones.map(c => ({
      id: c.id,
      proveedor: {
        id: c.proveedor.id,
        razonSocial: c.proveedor.razonSocial,
        cuit: c.proveedor.cuit
      },
      precioUnitario: Number(c.precioUnitario),
      monedaPrecio: c.monedaPrecio,
      plazoEntregaDias: c.plazoEntregaDias,
      tasaInteresMensual: c.tasaInteresMensual ? Number(c.tasaInteresMensual) : null,
      condicionesPago: c.condicionesPago,
      observaciones: c.observaciones,
      validaHasta: c.validaHasta,
      costoTotalEstimado: Number(c.precioUnitario) * Number(stats._sum.volumen ?? 0)
    })).sort((a, b) => a.precioUnitario - b.precioUnitario) // ordenadas por precio
  };
}

/**
 * Adjudica una campaña.
 * OPERACIÓN ATÓMICA: si algo falla, se revierte todo.
 */
export async function adjudicar(datos, usuario) {
  const { campanaId, cotizacionGanadoraId, precioMinoristaReferencia, motivoEleccion } = datos;

  return prisma.$transaction(async (tx) => {
    // 1. Validar campaña
    const campana = await tx.campana.findUnique({
      where: { id: campanaId },
      include: { producto: true }
    });
    if (!campana) throw new NotFoundError('Campaña');
    if (campana.estado !== 'EN_LICITACION') {
      throw new ConflictError(`No se puede adjudicar: estado actual es ${campana.estado}`);
    }

    // 2. Validar cotización ganadora
    const cotizacionGanadora = await tx.cotizacion.findUnique({
      where: { id: cotizacionGanadoraId }
    });
    if (!cotizacionGanadora || cotizacionGanadora.campanaId !== campanaId) {
      throw new ValidationError('Cotización no pertenece a esta campaña');
    }

    // 3. Validar que hay intenciones
    const intenciones = await tx.intencionCompra.findMany({
      where: { campanaId },
      include: { productor: true }
    });
    if (intenciones.length === 0) {
      throw new ConflictError('No hay intenciones para adjudicar');
    }

    // 4. Calcular totales y snapshot histórico
    const volumenTotal = intenciones.reduce((sum, i) => sum + Number(i.volumen), 0);
    const precioFinal = Number(cotizacionGanadora.precioUnitario);
    const ahorroEstimado = precioMinoristaReferencia
      ? (Number(precioMinoristaReferencia) - precioFinal) * volumenTotal
      : null;
    // % de ahorro agregado (regla D.4): cuánto más barato salió comprar en
    // grupo vs. el precio de referencia individual. Null si AUT no cargó
    // precioMinoristaReferencia (no siempre lo tiene a mano al adjudicar).
    const porcentajeAhorro = precioMinoristaReferencia && Number(precioMinoristaReferencia) > 0
      ? ((Number(precioMinoristaReferencia) - precioFinal) / Number(precioMinoristaReferencia)) * 100
      : null;

    // 5. Crear Adjudicacion
    const adjudicacion = await tx.adjudicacion.create({
      data: {
        campanaId,
        cotizacionGanadoraId,
        volumenTotalAdjudicado: volumenTotal,
        precioFinalUnitario: precioFinal,
        precioMinoristaReferencia: precioMinoristaReferencia ?? null,
        ahorroEstimadoTotal: ahorroEstimado,
        porcentajeAhorro,
        motivoEleccion
      }
    });

    // 6. Marcar cotización como ganadora
    await tx.cotizacion.update({
      where: { id: cotizacionGanadoraId },
      data: { esGanadora: true }
    });

    // 7. Crear OrdenCompra por cada intención
    const alicuotaIva = Number(campana.producto.alicuotaIva) / 100;
    const ordenes = [];

    for (const intencion of intenciones) {
      const volumenFinal = Number(intencion.volumen);
      const subtotal = volumenFinal * precioFinal;
      const iva = subtotal * alicuotaIva;
      const total = subtotal + iva;

      // Ahorro INDIVIDUAL de este productor: se prorratea el ahorro total de
      // la adjudicación según su propio volumen (regla D.4). El % de ahorro,
      // en cambio, es el mismo para todos (es un ratio de precio, no de
      // volumen) — se repite el valor de la adjudicación para no forzar al
      // frontend a ir a buscarlo a otra entidad cuando muestra "Mis órdenes".
      const ahorroEstimadoOrden = ahorroEstimado
        ? (ahorroEstimado / volumenTotal) * volumenFinal
        : null;

      const orden = await tx.ordenCompra.create({
        data: {
          adjudicacionId: adjudicacion.id,
          productorId: intencion.productorId,
          volumenFinal,
          precioUnitario: precioFinal,
          subtotal,
          iva,
          total,
          ahorroEstimado: ahorroEstimadoOrden,
          porcentajeAhorro,
          estadoPago: 'PENDIENTE'
        }
      });

      // 8. Crear Entrega (estado PENDIENTE)
      // En esta fase aún no hay módulo Entregas, pero el schema ya existe.
      // Se crea con datos básicos; el módulo Entregas (Fase 9) maneja transiciones.
      await tx.entrega.create({
        data: {
          ordenCompraId: orden.id,
          productorId: intencion.productorId,
          modalidad: intencion.modalidadEntregaPreferida ?? 'RETIRO_EN_DEPOSITO',
          depositoId: intencion.depositoPreferidoId ?? null,
          estado: 'PENDIENTE'
        }
      });

      ordenes.push(orden);
    }

    // 9. Cambiar estado de la campaña
    await tx.campana.update({
      where: { id: campanaId },
      data: { estado: 'ADJUDICADA' }
    });

    return { adjudicacion, ordenes, cotizacionGanadora };
  }, {
    isolationLevel: 'Serializable',
    timeout: 30000 // adjudicaciones grandes pueden tardar
  }).then((resultado) => {
    // 10. Eventos POST transacción (fuera del rollback scope)
    eventBus.emit('CAMPANA_ADJUDICADA', {
      adjudicacionId: resultado.adjudicacion.id,
      campanaId,
      cotizacionGanadoraId
    });

    for (const orden of resultado.ordenes) {
      eventBus.emit('ORDEN_GENERADA', {
        ordenId: orden.id,
        productorId: orden.productorId,
        campanaId,
        // El productor tiene que enterarse EN EL MOMENTO a qué precio se
        // concretó su compra y cuánto ahorró (regla D.4) — no solo un link.
        precioFinalUnitario: Number(orden.precioUnitario),
        total: Number(orden.total),
        porcentajeAhorro: orden.porcentajeAhorro ? Number(orden.porcentajeAhorro) : null
      });
    }

    // Notificar al proveedor ganador
    eventBus.emit('COTIZACION_ADJUDICADA', {
      cotizacionId: cotizacionGanadoraId,
      proveedorId: resultado.cotizacionGanadora.proveedorId
    });

    // Notificar a proveedores no elegidos
    prisma.cotizacion.findMany({
      where: { campanaId, esGanadora: false }
    }).then(rechazadas => {
      for (const c of rechazadas) {
        eventBus.emit('COTIZACION_RECHAZADA', {
          cotizacionId: c.id,
          proveedorId: c.proveedorId
        });
      }
    });

    return resultado.adjudicacion;
  });
}

export async function obtenerPorId(id) {
  const adj = await prisma.adjudicacion.findUnique({
    where: { id },
    include: {
      campana: { include: { producto: true } },
      ordenes: { include: { productor: true } }
    }
  });
  if (!adj) throw new NotFoundError('Adjudicación');
  return adj;
}

export async function listar({ page = 1, limit = 20 }) {
  const [data, total] = await Promise.all([
    prisma.adjudicacion.findMany({
      include: { campana: { include: { producto: true } } },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { adjudicadaAt: 'desc' }
    }),
    prisma.adjudicacion.count()
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
```

### 3. Módulo `ordenes` (CRUD básico)

```
backend/src/modules/ordenes/
├── ordenes.controller.js
├── ordenes.service.js
├── ordenes.routes.js
└── ordenes.test.js
```

#### `ordenes.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';

export async function listarMias(usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) throw new ForbiddenError();

  return prisma.ordenCompra.findMany({
    where: { productorId: productor.id },
    include: {
      adjudicacion: { include: { campana: { include: { producto: true } } } },
      entrega: { include: { deposito: true } },
      factura: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function listar({ estadoPago, page = 1, limit = 20 }) {
  const where = {};
  if (estadoPago) where.estadoPago = estadoPago;

  const [data, total] = await Promise.all([
    prisma.ordenCompra.findMany({
      where,
      include: {
        productor: { include: { usuario: { select: { email: true } } } },
        adjudicacion: { include: { campana: { include: { producto: true } } } }
      },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.ordenCompra.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id, usuario) {
  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: {
      productor: true,
      adjudicacion: { include: { campana: { include: { producto: true } } } },
      entrega: { include: { deposito: true } },
      factura: true
    }
  });
  if (!orden) throw new NotFoundError('Orden');

  if (usuario.rol === 'PRODUCTOR') {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: usuario.id } });
    if (orden.productorId !== productor.id) throw new ForbiddenError();
  }

  return orden;
}

export async function definirFormaPago(id, datos, usuario) {
  const orden = await obtenerPorId(id, usuario);
  return prisma.ordenCompra.update({
    where: { id },
    data: {
      formaPago: datos.formaPago,
      cuotas: datos.cuotas
    }
  });
}

export async function marcarPagada(id) {
  return prisma.ordenCompra.update({
    where: { id },
    data: { estadoPago: 'PAGADO' }
  });
}
```

### 4. Frontend: comparador de adjudicación (admin)

```
frontend/src/features/adjudicaciones/
├── api/adjudicaciones.api.js
├── pages/
│   ├── ComparadorPage.jsx           # Tabla comparativa de cotizaciones
│   └── AdjudicacionDetailPage.jsx
└── components/
    ├── CotizacionRow.jsx            # Una fila del comparador
    └── ConfirmarAdjudicacionModal.jsx
```

#### `ComparadorPage.jsx`

```jsx
export function ComparadorPage() {
  const { campanaId } = useParams();
  const { data } = useQuery({
    queryKey: ['comparador', campanaId],
    queryFn: () => adjudicacionesApi.obtenerComparador(campanaId)
  });

  const [seleccionada, setSeleccionada] = useState(null);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{data?.campana.nombre}</h1>
      <div className="bg-blue-50 p-4 rounded mb-6">
        <p>Volumen consolidado: <strong>{data?.campana.volumenConsolidado}</strong></p>
        <p>Productores agrupados: {data?.campana.cantidadProductores}</p>
      </div>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Proveedor</th>
            <th className="p-2 text-right">Precio unit.</th>
            <th className="p-2 text-right">Total estimado</th>
            <th className="p-2 text-center">Plazo (días)</th>
            <th className="p-2 text-left">Condiciones</th>
            <th className="p-2 text-center">Acción</th>
          </tr>
        </thead>
        <tbody>
          {data?.cotizaciones.map((c, i) => (
            <tr key={c.id} className={i === 0 ? 'bg-green-50' : ''}>
              <td className="p-2">{c.proveedor.razonSocial}</td>
              <td className="p-2 text-right">{c.monedaPrecio} {c.precioUnitario.toFixed(4)}</td>
              <td className="p-2 text-right font-semibold">{c.monedaPrecio} {c.costoTotalEstimado.toFixed(2)}</td>
              <td className="p-2 text-center">{c.plazoEntregaDias}</td>
              <td className="p-2 text-sm">{c.condicionesPago}</td>
              <td className="p-2 text-center">
                <button onClick={() => setSeleccionada(c)}
                        className="bg-aut-verde text-white px-3 py-1 rounded text-sm">
                  Elegir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {seleccionada && (
        <ConfirmarAdjudicacionModal
          cotizacion={seleccionada}
          campana={data.campana}
          onCancel={() => setSeleccionada(null)}
          onConfirm={(payload) => adjudicacionesApi.adjudicar(payload)}
        />
      )}
    </div>
  );
}
```

---

## Tests

- Adjudicar campaña EN_LICITACION → 201 + orden por cada intención + estado pasa a ADJUDICADA.
- Adjudicar campaña ya adjudicada → 409.
- Adjudicar con cotización que no pertenece a la campaña → 400.
- Verificar atomicidad: forzar un error en medio de la transacción y comprobar rollback completo.
- Verificar cálculos: IVA, totales, snapshot histórico.
- Adjudicar con `precioMinoristaReferencia` cargado → `Adjudicacion.porcentajeAhorro` y `ahorroEstimadoTotal` correctos; cada `OrdenCompra` tiene su `ahorroEstimado` prorrateado por volumen y el mismo `porcentajeAhorro` que la adjudicación.
- Adjudicar sin `precioMinoristaReferencia` → ambos campos de ahorro quedan `null` (no se inventa un valor).
- Evento `ORDEN_GENERADA` incluye `precioFinalUnitario`, `total` y `porcentajeAhorro` en el payload.

---

## Checklist de cierre

- [ ] Migración `add_adjudicaciones` aplicada.
- [ ] Endpoint POST `/api/adjudicaciones` con transacción atómica.
- [ ] Endpoints `/api/ordenes/*` operativos.
- [ ] Comparador admin renderiza correctamente con ranking por precio.
- [ ] Eventos disparados generan notificaciones a productores y proveedores.
- [ ] Productor ve sus órdenes en "Mis órdenes".
- [ ] Coverage ≥ 60%.
- [ ] Tag: `v0.7-fase-7-adjudicacion`.

---

## Próximo paso

[`13-FASE-8-DEPOSITOS-STOCK.md`](./13-FASE-8-DEPOSITOS-STOCK.md)
