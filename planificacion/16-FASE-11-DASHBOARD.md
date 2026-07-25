# Fase 11 — Dashboard de KPIs

> **Sprint:** 12 (1 semana)
> **Objetivo:** Tablero gerencial con los indicadores que AUT y los socios quieren ver para validar el valor del sistema.

---

## Resultado esperado

Dashboard que muestra (según rol):

**Para ADMIN/CONTADOR:**
- Ahorro acumulado generado a productores (en pesos y en %).
- Volumen total transaccionado por insumo y por período.
- Tasa de adopción (productores activos vs total).
- Balance IVA crédito vs débito.
- Ranking de proveedores.
- Top productores compradores.
- Forma de pago más adoptada.

**Para PRODUCTOR (mini-dashboard personal):**
- Mi ahorro total acumulado.
- Mis compras totales.
- Mi próxima entrega.

---

## Prerrequisitos

- Fase 10 completa. Datos reales empiezan a fluir.

---

## Tareas

### 1. Módulo `dashboard`

```
backend/src/modules/dashboard/
├── dashboard.controller.js
├── dashboard.service.js
├── dashboard.routes.js
└── dashboard.test.js
```

#### `dashboard.service.js`

```javascript
import { prisma } from '../../config/database.js';

export async function obtenerKpis({ desde, hasta }) {
  const dateFilter = construirFiltroFechas(desde, hasta);

  const [
    totalCampanas,
    campanasActivas,
    totalAdjudicaciones,
    totalOrdenes,
    ahorroTotal,
    volumenTotal,
    productoresActivos,
    productoresTotales
  ] = await Promise.all([
    prisma.campana.count({ where: dateFilter }),
    prisma.campana.count({ where: { ...dateFilter, estado: { in: ['ABIERTA', 'EN_LICITACION'] } } }),
    prisma.adjudicacion.count({ where: { adjudicadaAt: dateFilter.createdAt || {} } }),
    prisma.ordenCompra.count({ where: dateFilter }),
    prisma.adjudicacion.aggregate({ _sum: { ahorroEstimadoTotal: true } }),
    prisma.ordenCompra.aggregate({ _sum: { volumenFinal: true } }),
    prisma.productor.count({
      where: {
        aprobado: true,
        usuario: { activo: true, ultimoLoginAt: { gte: hace30Dias() } }
      }
    }),
    prisma.productor.count({ where: { aprobado: true } })
  ]);

  return {
    campanas: { total: totalCampanas, activas: campanasActivas },
    adjudicaciones: totalAdjudicaciones,
    ordenes: totalOrdenes,
    ahorroAcumulado: Number(ahorroTotal._sum.ahorroEstimadoTotal ?? 0),
    volumenAcumulado: Number(volumenTotal._sum.volumenFinal ?? 0),
    tasaAdopcion: productoresTotales > 0
      ? { activos: productoresActivos, total: productoresTotales, porcentaje: (productoresActivos / productoresTotales) * 100 }
      : { activos: 0, total: 0, porcentaje: 0 }
  };
}

export async function obtenerVolumenPorInsumo({ desde, hasta }) {
  // Volumen agregado agrupado por producto
  const ordenes = await prisma.ordenCompra.findMany({
    where: construirFiltroFechas(desde, hasta),
    include: { adjudicacion: { include: { campana: { include: { producto: true } } } } }
  });

  const agrupado = ordenes.reduce((acc, orden) => {
    const producto = orden.adjudicacion.campana.producto;
    const key = producto.id;
    if (!acc[key]) {
      acc[key] = {
        productoId: producto.id,
        nombre: producto.nombre,
        unidadMedida: producto.unidadMedida,
        volumenTotal: 0,
        montoTotal: 0
      };
    }
    acc[key].volumenTotal += Number(orden.volumenFinal);
    acc[key].montoTotal += Number(orden.total);
    return acc;
  }, {});

  return Object.values(agrupado).sort((a, b) => b.montoTotal - a.montoTotal);
}

export async function obtenerRankingProveedores({ desde, hasta }) {
  const adjudicaciones = await prisma.adjudicacion.findMany({
    include: {
      campana: { include: { producto: true } },
      cotizacionGanadora: {
        include: {
          proveedor: { select: { id: true, razonSocial: true } }
        }
      }
    }
  });

  const agrupado = adjudicaciones.reduce((acc, adj) => {
    const prov = adj.cotizacionGanadora?.proveedor;
    if (!prov) return acc;
    const key = prov.id;
    if (!acc[key]) {
      acc[key] = {
        proveedorId: prov.id,
        razonSocial: prov.razonSocial,
        campanasGanadas: 0,
        volumenAdjudicado: 0
      };
    }
    acc[key].campanasGanadas += 1;
    acc[key].volumenAdjudicado += Number(adj.volumenTotalAdjudicado);
    return acc;
  }, {});

  return Object.values(agrupado).sort((a, b) => b.campanasGanadas - a.campanasGanadas);
}

export async function obtenerTopProductores({ limit = 10 }) {
  const productores = await prisma.ordenCompra.groupBy({
    by: ['productorId'],
    _sum: { total: true, volumenFinal: true },
    _count: true,
    orderBy: { _sum: { total: 'desc' } },
    take: limit
  });

  // Enriquecer con datos del productor
  const ids = productores.map(p => p.productorId);
  const datos = await prisma.productor.findMany({ where: { id: { in: ids } } });

  return productores.map(p => {
    const datos_p = datos.find(d => d.id === p.productorId);
    return {
      productorId: p.productorId,
      razonSocial: datos_p?.razonSocial,
      totalCompras: Number(p._sum.total ?? 0),
      volumenTotal: Number(p._sum.volumenFinal ?? 0),
      cantidadOrdenes: p._count
    };
  });
}

export async function obtenerBalanceIva({ desde, hasta }) {
  const facturas = await prisma.factura.aggregate({
    where: { emitidaAt: construirFiltroFechas(desde, hasta).emitidaAt || {} },
    _sum: { iva: true }
  });

  // IVA débito = lo que AUT facturó a productores
  const ivaDebito = Number(facturas._sum.iva ?? 0);

  // IVA crédito = lo que AUT pagó a proveedores
  // En v1 (sin AFIP automatizado), esto se calcula manualmente o se importa de BIT
  // Estimación a partir de adjudicaciones: precio × volumen × alicuota
  const adjudicaciones = await prisma.adjudicacion.findMany({
    include: { campana: { include: { producto: true } } }
  });

  const ivaCredito = adjudicaciones.reduce((sum, adj) => {
    const alicuota = Number(adj.campana.producto.alicuotaIva) / 100;
    return sum + (Number(adj.volumenTotalAdjudicado) * Number(adj.precioFinalUnitario) * alicuota);
  }, 0);

  return {
    ivaDebito,
    ivaCredito,
    saldo: ivaCredito - ivaDebito,
    nota: 'En v1 los valores son estimados. La fuente fiscal definitiva es BIT.'
  };
}

export async function obtenerFormasPagoFrecuentes() {
  const ordenes = await prisma.ordenCompra.groupBy({
    by: ['formaPago'],
    _count: true,
    _sum: { total: true },
    where: { formaPago: { not: null } }
  });

  return ordenes.map(o => ({
    formaPago: o.formaPago,
    cantidad: o._count,
    montoTotal: Number(o._sum.total ?? 0)
  })).sort((a, b) => b.cantidad - a.cantidad);
}

export async function obtenerMiDashboard(usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) return null;

  const [ordenes, proximaEntrega] = await Promise.all([
    prisma.ordenCompra.aggregate({
      where: { productorId: productor.id },
      _count: true,
      _sum: { total: true, volumenFinal: true }
    }),
    prisma.entrega.findFirst({
      where: {
        productorId: productor.id,
        estado: { in: ['PENDIENTE', 'EN_TRANSITO', 'DISPONIBLE_PARA_RETIRO', 'EN_RUTA_A_CAMPO'] }
      },
      orderBy: { fechaEstimada: 'asc' },
      include: { deposito: true, ordenCompra: { include: { adjudicacion: { include: { campana: { include: { producto: true } } } } } } }
    })
  ]);

  // Calcular mi ahorro: sumar ahorroEstimado proporcional por cada orden mía
  const misAdjudicaciones = await prisma.adjudicacion.findMany({
    where: { ordenes: { some: { productorId: productor.id } } },
    include: { ordenes: { where: { productorId: productor.id } } }
  });

  let miAhorro = 0;
  for (const adj of misAdjudicaciones) {
    if (adj.ahorroEstimadoTotal && adj.volumenTotalAdjudicado) {
      const ahorroUnitario = Number(adj.ahorroEstimadoTotal) / Number(adj.volumenTotalAdjudicado);
      const miVolumen = adj.ordenes.reduce((s, o) => s + Number(o.volumenFinal), 0);
      miAhorro += ahorroUnitario * miVolumen;
    }
  }

  return {
    cantidadOrdenes: ordenes._count,
    totalGastado: Number(ordenes._sum.total ?? 0),
    volumenTotal: Number(ordenes._sum.volumenFinal ?? 0),
    ahorroAcumulado: miAhorro,
    proximaEntrega
  };
}

// ============================================================

function construirFiltroFechas(desde, hasta) {
  const filter = {};
  if (desde || hasta) {
    filter.createdAt = {};
    if (desde) filter.createdAt.gte = new Date(desde);
    if (hasta) filter.createdAt.lte = new Date(hasta);
  }
  return filter;
}

function hace30Dias() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}
```

### 2. Frontend: dashboard

Para gráficos, instalar:

```bash
cd frontend
npm install recharts
```

```
frontend/src/features/dashboard/
├── api/dashboard.api.js
├── pages/
│   ├── DashboardAdminPage.jsx          # Vista AUT
│   └── DashboardProductorPage.jsx       # Vista productor (mini)
└── components/
    ├── KpiCard.jsx                      # Tarjeta de KPI individual
    ├── VolumenPorInsumoChart.jsx        # Bar chart con Recharts
    ├── RankingProveedoresTable.jsx
    ├── TopProductoresTable.jsx
    ├── BalanceIvaCard.jsx
    └── FormasPagoChart.jsx              # Pie chart
```

#### `DashboardAdminPage.jsx` (extracto)

```jsx
export function DashboardAdminPage() {
  const [filtros, setFiltros] = useState({ desde: '', hasta: '' });

  const { data: kpis } = useQuery({
    queryKey: ['dashboard', 'kpis', filtros],
    queryFn: () => dashboardApi.kpis(filtros)
  });

  const { data: volumen } = useQuery({
    queryKey: ['dashboard', 'volumen', filtros],
    queryFn: () => dashboardApi.volumenPorInsumo(filtros)
  });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard AUT</h1>

      {/* Filtros de fecha */}
      <FiltrosFechas filtros={filtros} onChange={setFiltros} />

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <KpiCard titulo="Ahorro acumulado" valor={`$${kpis?.ahorroAcumulado.toLocaleString('es-AR')}`} />
        <KpiCard titulo="Campañas activas" valor={kpis?.campanas.activas} />
        <KpiCard titulo="Volumen total" valor={kpis?.volumenAcumulado.toLocaleString('es-AR')} />
        <KpiCard
          titulo="Tasa de adopción"
          valor={`${kpis?.tasaAdopcion.porcentaje.toFixed(1)}%`}
          subtexto={`${kpis?.tasaAdopcion.activos} de ${kpis?.tasaAdopcion.total} productores`}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-4">Volumen por insumo</h2>
          <VolumenPorInsumoChart data={volumen} />
        </div>
        <BalanceIvaCard />
        <RankingProveedoresTable />
        <TopProductoresTable />
        <FormasPagoChart />
      </div>
    </div>
  );
}
```

### 3. Endpoint export Excel

```bash
npm install exceljs
```

`dashboard.controller.js`:

```javascript
import ExcelJS from 'exceljs';

export async function exportarExcel(req, res, next) {
  try {
    const { kpis, volumen, ranking, topProd } = await Promise.all([
      dashboardService.obtenerKpis(req.query),
      dashboardService.obtenerVolumenPorInsumo(req.query),
      dashboardService.obtenerRankingProveedores(req.query),
      dashboardService.obtenerTopProductores({ limit: 50 })
    ]).then(([k, v, r, t]) => ({ kpis: k, volumen: v, ranking: r, topProd: t }));

    const workbook = new ExcelJS.Workbook();

    // Hoja KPIs
    const sheetKpis = workbook.addWorksheet('KPIs');
    sheetKpis.columns = [{ header: 'Indicador', key: 'k', width: 30 }, { header: 'Valor', key: 'v', width: 20 }];
    sheetKpis.addRows([
      { k: 'Ahorro acumulado', v: kpis.ahorroAcumulado },
      { k: 'Volumen total', v: kpis.volumenAcumulado },
      { k: 'Campañas activas', v: kpis.campanas.activas },
      { k: 'Tasa adopción (%)', v: kpis.tasaAdopcion.porcentaje.toFixed(2) }
    ]);

    // Hoja volumen por insumo
    const sheetVol = workbook.addWorksheet('Volumen por insumo');
    sheetVol.columns = [
      { header: 'Producto', key: 'nombre', width: 30 },
      { header: 'Volumen total', key: 'volumenTotal', width: 15 },
      { header: 'Unidad', key: 'unidadMedida', width: 12 },
      { header: 'Monto total', key: 'montoTotal', width: 18 }
    ];
    sheetVol.addRows(volumen);

    // ... agregar más hojas

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-aut-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
}
```

---

## Tests

- Cálculo de ahorro acumulado correcto.
- Tasa de adopción coincide con productores que loguearon últimos 30 días.
- Top productores ordenados correctamente por monto.
- Export Excel descarga archivo válido.

---

## Checklist de cierre

- [ ] Endpoints `/api/dashboard/*` operativos.
- [ ] Cálculos verificados contra queries manuales en MySQL.
- [ ] Frontend muestra dashboard con gráficos.
- [ ] Export a Excel funcional.
- [ ] Mini-dashboard del productor visible.
- [ ] Coverage ≥ 60%.
- [ ] Tag: `v0.11-fase-11-dashboard`.

---

## Próximo paso

[`17-FASE-12-DEPLOY.md`](./17-FASE-12-DEPLOY.md)
