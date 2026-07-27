# Fase 3 — Catálogo de Productos

> **Sprint:** 3 (3-4 días)
> **Objetivo:** CRUD de productos del catálogo, con categorías, unidades de medida y alícuotas de IVA.

---

## Resultado esperado

- ADMIN puede crear, editar, desactivar productos.
- Cualquier usuario autenticado puede listar productos activos.
- El producto tiene categoría, unidad de medida y alícuota IVA (campo crítico para facturación).

---

## Prerrequisitos

- Fase 2 completa.

---

## Tareas

### 1. Schema Prisma

Agregar modelo `Producto` y enums `CategoriaProducto`, `UnidadMedida`. Migrar:

```bash
npx prisma migrate dev --name add_productos
```

### 2. Módulo `productos`

```
backend/src/modules/productos/
├── productos.controller.js
├── productos.service.js
├── productos.routes.js
├── productos.schemas.js
└── productos.test.js
```

#### `productos.schemas.js`

```javascript
import { z } from 'zod';

export const crearProductoSchema = z.object({
  nombre: z.string().min(2).max(100),
  descripcion: z.string().max(1000).optional(),
  categoria: z.enum(['AGROQUIMICO', 'FERTILIZANTE', 'SEMILLA', 'INOCULANTE', 'NUTRICION_ANIMAL', 'SANIDAD_ANIMAL', 'OTRO']),
  unidadMedida: z.enum(['LITRO', 'KILO', 'UNIDAD', 'TONELADA', 'BOLSA']),
  alicuotaIva: z.number().positive().max(50)
});

export const actualizarProductoSchema = crearProductoSchema.partial();

export const filtrosProductoSchema = z.object({
  categoria: z.enum(['AGROQUIMICO', 'FERTILIZANTE', 'SEMILLA', 'INOCULANTE', 'NUTRICION_ANIMAL', 'SANIDAD_ANIMAL', 'OTRO']).optional(),
  activo: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
```

#### `productos.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';

export async function listar({ categoria, activo, search, page, limit }) {
  const where = {};
  if (categoria) where.categoria = categoria;
  if (activo !== undefined) where.activo = activo;
  if (search) {
    where.OR = [
      { nombre: { contains: search } },
      { descripcion: { contains: search } }
    ];
  }

  const [data, total] = await Promise.all([
    prisma.producto.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { nombre: 'asc' }
    }),
    prisma.producto.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id) {
  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) throw new NotFoundError('Producto');
  return producto;
}

export async function crear(datos) {
  return prisma.producto.create({ data: datos });
}

export async function actualizar(id, datos) {
  await obtenerPorId(id);
  return prisma.producto.update({ where: { id }, data: datos });
}

export async function desactivar(id) {
  // Soft delete: si el producto fue parte de campañas pasadas, NO se borra
  const producto = await obtenerPorId(id);

  const enUso = await prisma.campana.count({
    where: { productoId: id, estado: { in: ['ABIERTA', 'EN_LICITACION'] } }
  });
  if (enUso > 0) {
    throw new ConflictError('No se puede desactivar: hay campañas activas con este producto');
  }

  return prisma.producto.update({ where: { id }, data: { activo: false } });
}
```

#### `productos.controller.js`

```javascript
import * as productosService from './productos.service.js';

export async function listar(req, res, next) {
  try {
    const resultado = await productosService.listar(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const producto = await productosService.obtenerPorId(Number(req.params.id));
    res.json(producto);
  } catch (err) { next(err); }
}

export async function crear(req, res, next) {
  try {
    const producto = await productosService.crear(req.body);
    res.status(201).json(producto);
  } catch (err) { next(err); }
}

export async function actualizar(req, res, next) {
  try {
    const producto = await productosService.actualizar(Number(req.params.id), req.body);
    res.json(producto);
  } catch (err) { next(err); }
}

export async function desactivar(req, res, next) {
  try {
    await productosService.desactivar(Number(req.params.id));
    res.status(204).send();
  } catch (err) { next(err); }
}
```

#### `productos.routes.js`

```javascript
import { Router } from 'express';
import * as ctrl from './productos.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { crearProductoSchema, actualizarProductoSchema, filtrosProductoSchema } from './productos.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', validate(filtrosProductoSchema, 'query'), ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);

router.post('/', requireRole(['ADMIN']), validate(crearProductoSchema), ctrl.crear);
router.patch('/:id', requireRole(['ADMIN']), validate(actualizarProductoSchema), ctrl.actualizar);
router.delete('/:id', requireRole(['ADMIN']), ctrl.desactivar);

export default router;
```

> **Catálogo real — resuelto (2026-07):** Nicolás confirmó tomar de `Lista USD - 2026-07-22T150816.251.xls` (Hoja 1 "USD", lista de precios de un proveedor) **todas** las secciones de insumos de aplicación: agroquímicos, fertilizantes, aceites/coadyuvantes, curasemillas e inoculantes. La Hoja 2 "Articulos" (2.951 SKUs genéricos de un distribuidor) queda **fuera de alcance por decisión explícita** — no se importa. Ver `DECISIONES-PENDIENTES.md` punto 1.

### 3. Seed de productos iniciales

`backend/prisma/seed.js`. El array de abajo reemplaza el placeholder de 9 productos: son los **275 productos reales** extraídos y deduplicados de la Hoja 1 del Excel de AUT —173 agroquímicos, 50 fertilizantes, 22 aceites/coadyuvantes, 11 curasemillas y 19 inoculantes (algunos ítems de la sección "Curasemillas" del Excel son en realidad inoculantes combinados con fungicida, y se reclasificaron como `INOCULANTE`, ver comentario en el código). Se mantiene el nombre tal cual figura en la lista del proveedor (mayúsculas, abreviaturas tipo "AGROQ", "x lt") para no perder trazabilidad con el origen; renombrarlos para una vista más prolija de cara al productor es una tarea de UI/frontend (mostrar un `nombre` más lindo no exige tocar el dato de catálogo), no de este seed.

**Cómo se dedujo cada campo:**
- `categoria`: secciones "Glifosato/Herbicidas/Graminicidas/Insecticidas/Fungicidas" y "Aceites y coadyuvantes" → `AGROQUIMICO` (los aceites/coadyuvantes son insumos de aplicación junto con el agroquímico, no tienen categoría propia en el enum). Sección "Fertilizantes" → `FERTILIZANTE`. Sección "Inoculantes", más los ítems de "Curasemillas" cuyo nombre empieza con "INOC" (son inoculante + fungicida combinado) → `INOCULANTE`. El resto de "Curasemillas" (tratamientos químicos puros de semilla: TEBUCONAZOLE, IMIDACLOPRID, METALAXIL, etc.) → `AGROQUIMICO`.
- `unidadMedida`: inferida del sufijo de la descripción («x lt/Lt/LTS» → `LITRO`; «x kg/Kgs/gr/grs» → `KILO`; «x 25/50 kg» en formato de bolsa cerrada → `BOLSA`; sin sufijo reconocible, ej. packs por hectárea o por lote de semilla → `UNIDAD`). Es una heurística de texto — conviene que alguien de AUT revise la lista antes de producción, sobre todo los que quedaron en `UNIDAD` por defecto.
- `alicuotaIva`: 10,5% para agroquímicos/fertilizantes/aceites-coadyuvantes/curasemillas, 21% para inoculantes — mismo criterio que ya traía el seed placeholder original (`INOCULANTE` allí tenía 21%). **Referencial, a confirmar con el contador.**

```javascript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const productosAgroquimicosYFertilizantes = [
  // --- Agroquímicos (174) — fuente: lista de precios del proveedor, Hoja 1 'USD' ---
  { nombre: 'AGROQ GLIFOSATO ORION FULL x L', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ ATILA MAX', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLIFOSATO ORION FORTE x L', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLIFOSATO GRANULADO 88% x kg', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'GLIFOSATO GRANULADO 75.7% x kg', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLIFOS.SUPER ESTR.GRANULADO', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLIFOS.SUPER ESTRELLA II X LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLIFOS. ESTRELLA AURUM II x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLIFOSATO 66,2 % x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLIFOS. GRAN. ESTRELLA WDG x 10 k', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLIFOS. PLATINUM LA TIJERETA x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLIFO POWER PLUS II ATANOR x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLIFOSATO GRAN. SNIPER DRY x kg', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLIFOSATO SULFOSATO x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLIFOSATO GRAN. BOX LA TIJERETA x kg', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GLUFOSIN 20%', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'GLUFOSINATO DE AMONIO 20% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ SULFENTRAZONE 50% x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HERBICIDA AXIAL x L', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ SULFENTRAZONE x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ PRESIDE X LTS', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ METSULFURON SOBRE x 50 GRS', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ METSULFURON SOBRE x 100 GRS', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ METSULFURON SOBRE x 250 GRS', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ 2 4 D B X LTS', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: '2 4 D AMINA 85 x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ 2 4 D NO VOLATIL x LTS', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ 2 4 D NO VOLATIL DUAL SAL 70% x L', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ ACETOCLOR', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGR P/GRANO ALMAC. ACTELLIC 50 x 1 lt', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ 2 4 D NO VOLATIL M E x lts', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ 2 4 D HEXIL 90% x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ ABAMECTINA 3% + BIFENTRIN 10% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ ABAMECTINA 3,6%', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. HERBICIDA ADENGO x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ ATRAZINA 90 Gran. x KGS', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ ATRAZINA 90 Gran. x Kgs', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ ATRAZINA 50 LIQUIDA x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CLORIMURON 25% x 600 grs', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'TERBUTILAZINA 50% x LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ BENAZOLIN x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CLORIMURON 25% x 200 grs', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CLORIMURON 25% x 400 grs', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CLORIMURON 75 x 100 grs', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ DICAMBA x LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ DIFLUFENICAN 50% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HERBICIDA FLUMIOXAZIN x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ DARREN (SUMISOYA) x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. HERBICIDA HEAT SOBRE x 350 grs', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ FLUROXIPIR 20 % EC x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GALANT x LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ IMAZAPIR x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ IMAZETAPIR 10,6 % LIQUIDO x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ IMAZETAPIR LIQUIDO x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ METOLACLOR 96 % x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ METOLACLORO 96 % x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ S-METOLACLOR x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'HERBICIDA S-METOLACLOR x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HERBICIDA LIGATE x kg', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HERBICIDA METRIBUZIN x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ NICOSULFURON 75 WG x 300 gr', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ NICOSULFURON 4% LPU x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ NICOSULFURON sobres x 500 grs', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ NICOSULFURON 75 LUXIA x KG', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ PARAQUAT x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ PICLORAM 24 x Lts', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'PICLORAM x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ PROMETRINA x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ SPIDER SOBRE x 500 Gs', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ SULFOSATO x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ SUMISOYA FLO x 1 litro', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ TOCON x 1 Lt', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ PASTAR x Lts', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ TOGAR B T x LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ FLUOROCLORIDONE 25% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ ONDUTY KIT (1+3.75) P/5 Hs', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ MAYORAL x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HERBICIDA FINESSE x 150 grs', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CONVEY (TOPRAMEZONE 33,6 %) x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ FOMESAFEN 25%', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ FOMESAFEN x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'ACURON UNO x LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HERB FIERCE x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. HERB. NICOSULFURON 24% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HERB MESOTRIONE x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. TOP GROUND PACK P/4 has', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGRO HERB. HUSSAR PACK P/20 HAS', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'GLUFOSINATO DE AMONIO 40% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. GIZMO x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. HERB. P/TRIGO BRAITON x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. HERB. 2 4 D ENLIST CORTEVA x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ DICLOSULAM x 500 grs', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HERBICIDA APRESA x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. HERBICIDA STAGGER x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGR. HERBICIDA FLEXSTAR GT x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGR. HERB. FLUMETSULAN 24% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGR DINAMIC 70 WDG (AMICARBAZONE 70%)x k', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGR HERB. PIROXASULFONE 85% x kg', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGR. HERBICIDA CARFENTRAZONE 40% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ NICOSULFURON 75 % PACK P/6 has', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HALOXIFOP 12.5 %', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HALOXIFOP 54%-HL x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HERBAN LPU', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HALOXIFOP 54% x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ HALOXIFOP 93% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CLETODIM 24 % x 5 lts', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CLETODIM 24 + QUIZALOFOP 12 x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CLETODIM 24 g', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ SHERIFF MAX 10,8 % x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CLETODIM 48% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CARBENDAZIM 50 % x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'ABAMECTINA 3,6% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ PATON FLOW x 1 LT', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CIPERMETRINA x LTS', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CLORPIRIFOS x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CLIPEUS MAX x 1 lt', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CORAGEN (Rynaxypir 20 %) x 1 lt', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ DIMETOATO x Lts', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ INSECTICIDA CLAP x 250 cc', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ GALIL x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ LAMBDA 25 % MICROENCAPSUL. x 1 Lt', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. FIPRONIL x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'FIPRONIL 20 SC CUCARACHICIDA x 250 cc', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ LAMBDACIALOTRINA x Lts', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ LUFENURON 5 % x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ LUFENURON 5% + PROFENOFOS 50% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ SYNERGY (Imida+lambda) x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ NOVALURON+BIFENTRIN x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ BELT (Flubendiamide 48 %) x 1 lt', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ BIFENTRIN 10 %', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CRUZA (Imidacloprid+Bifentr) x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ LUFEN 5% + PROFEN 50% x lt CyO (QUIRON)', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'BIFENTRIN 10% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ BIFENTRIN 25 %', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ IMIDACLOPRID 35% (Azote) x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ LAMBDACIALOTRINA CyO x Lts', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ TIAMETOXAN+LAMBDACIALOTRINA x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ REPEL CHEM MAX (repelente para silo) x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. STARKLE 70 WG x 1,7 kg', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'TALANTE PLUS PACK SOJA P/10 HAS', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. FUNGICIDA CRIPTON x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'INSEC. STACK IMIDA+LAMBDA+BIFENTRIN x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. INSEC. EXPEDITION CORTEVA x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. INSEC. INTREPID CORTEVA x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'INSECTICIDA TALANTE PLUS x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ INSECTICIDA QUIRON x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. INSEC. ZETAMETRINA FURY x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. INSECT. ZARIVA x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ INSECT RIMON SUPRA NOVALURON x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGR. INSEC BIFENTRIN 3% + IMIDA 10% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ INSECTICIDA PLACK x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGR INSEC. MENTOR ACA x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. HACKER TOP x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGR INSECTICIDA MUSTANG 20EW x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGR INSECT. ARCHER PLUS x 500 ml', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ INSECT. BEAUVERIA SP x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. INSECT. BIOKATO x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ BENZOMYL PLUS x kg', categoria: 'AGROQUIMICO', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ INSEC CLORANTRANILIPROLE 20% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. AZOXIS 20 + CYPROCO 8 CyO x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. AZOXY 20 + CYPROCO 8 x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ AMISTAR XTRA (Tempus)', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CLEANER x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ TEBUCONAZOLE 25 % x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ TEBUCONAZOLE 43% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'SPIKE X-TRA (5+5) x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGR. FUNG. MIRAVIS DUO (DIFE+PYDI) x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ FUNGICIDA STINGER x lts', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGR. FUN. PROTIO 17.5% + TRIFLO 15% x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'FIPRONIL 20 SC CUCARACHICIDA x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGR FUNGICIDA FIDRESA X LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGR FUNGICIDA NANOK x LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ FUNG. PYRACLOS+EPOXI (OPERA) x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  // --- Fertilizantes (50) ---
  { nombre: 'FERTILIZANTE ARRANCADOR 15-30 x 50 kg', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE FOSFATO MONOAMONICO X 50 K', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE SUPER SIMPLE x 50 KG', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE SUPER SIMPLE x 25 KG', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE SUPER FOSFATO TRIPLE x 50 K', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE SUPER FOSFATO TRIPLE x 25 K', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE FOSFATO DIAMONICO X 50 KGS', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE FOSFATO DIAMONICO X 25 KGS', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE UREA BSA x 50 KG', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE UREA BSA x 25 KG', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE FOSFATO MONOAMONICO X 25 K', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE ARRANCADOR 14-34-00-09 x 50', categoria: 'FERTILIZANTE', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE ARRANCADOR C20-20-0-12 x 50', categoria: 'FERTILIZANTE', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE ARRANCADOR 20-30-0-8 x 50 k', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE FOSFATO DIAMONICO x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE FOSFATO DIAMONICO GRANEL', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE SUPER SIMPLE x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE FOSFATO SIMPLE GRANEL', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE FOSFATO TRIPLE GRANEL', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE SUPER FOSFATO TRIPLE x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE UREA x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE UREA GRANEL', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE FOSFATO MONOAMONICO x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE MEZCLA 7-40-0-5-7 GRANEL', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'SULFATO DE CALCIO CEFAS BOLSA x 50 K', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'SULFATO DE CALCIO CEFAS x Kgs', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'SULFATO DE CALCIO PELETEADO x Kgs', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'SULFATO DE CALCIO SOBREPELETEADO x Kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'YESO AGRICOLA MRD 2500 x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE MRD 2500 NPK 10-5-0 x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'GROUND MAX FOSMAX x 20 lt', categoria: 'FERTILIZANTE', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'SULF. AMONIO ROCIO x lt', categoria: 'FERTILIZANTE', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'MIST BALANCE x 15 lts', categoria: 'FERTILIZANTE', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'MIST NITROGENADO x 15 lts', categoria: 'FERTILIZANTE', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'MIST YESO x 15 lts', categoria: 'FERTILIZANTE', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'MIST MEZCLA x 15 lts', categoria: 'FERTILIZANTE', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'MIST PRADO-PRD x 15 lts', categoria: 'FERTILIZANTE', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'MIST FOSFORO x 15 lts', categoria: 'FERTILIZANTE', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'LIQUIDO UAN x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'LIQUIDO SolMix x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE MICROESENTIAL SZ x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'MICROESSENTIALS SZ ACA x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'MICROESSENTIALS S9 ACA x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'MICROESSENTIALS BLEND NUTRI 50 ACA x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'BIO FERTILIZANTE METHYLO SP x lt', categoria: 'FERTILIZANTE', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'NANOMIX NITRO x 15 lts', categoria: 'FERTILIZANTE', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'NANOMIX FOSFOROMIX x lt', categoria: 'FERTILIZANTE', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'SULFATO DE CALCIO PELET BSA x 25 Kgs', categoria: 'FERTILIZANTE', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'SULFATO DE CALCIO POLVO x kg', categoria: 'FERTILIZANTE', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'FERTILIZANTE FOLIAR HEDGE MAX x lt', categoria: 'FERTILIZANTE', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  // --- Aceites y coadyuvantes (22) — se usan junto con agroquímicos en la aplicación ---
  { nombre: 'ACEITE METILADO x lt CyO (FULL OIL METILADO)', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'ACEITE METILADO x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'ACEITE ROCIO BIDÓN x 3 lt', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE ROCIO (Caja p/10 has)', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE ROCIO (Caja p/20 has)', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ SULF. AMONIO SULFUS X lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE LECITINA DE SOJA x 1 LT', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE WOHR NATURE x 1 LT', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE x 1 LT', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE SMART ACTIVE x LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE DASH x LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ. DESINCRUSTANTE x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE HARRIER x 1 LT', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE FULLCONTROL x 1 LT', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'ACEITE ABSOLUT x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'FULL OIL Siliconado x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE A35T GOLD x LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE BIO FUSION x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE METILATUS 70 X LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE ROCIO ULTRA PACK P/20 HAS', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE RCP x LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'COADYUVANTE ONE DROP x LT', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  // --- Curasemillas (11): tratamientos químicos de semilla -> AGROQUIMICO; los 'INOC...' combinados con fungicida/insecticida -> INOCULANTE ---
  { nombre: 'AGROQ ESTRIBO CURASEM INSECT x 1 Lt', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ FLOW SIST CURASEM FUNG.x L', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CURASEM (TEBUCONAZ+IMIDAC) x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CURASEM TEBUCONAZOLE+IMIDACLOPID', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'INOCUL+FUNG P/TRIGO CRINIGAN PARA 800 KG', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC P/ALFALFA CRINIGAN P/25 KG', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC P/TRIGO FUNG+INSEC P/2000KG.SEM', categoria: 'INOCULANTE', unidadMedida: 'UNIDAD', alicuotaIva: 21 },
  { nombre: 'INOC P/SOJA (T+C) P/2500 kg sem', categoria: 'INOCULANTE', unidadMedida: 'UNIDAD', alicuotaIva: 21 },
  { nombre: 'AGROQ CURASEM METALAXIL x Lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'AGROQ CURASEM IMIDACLOP. 60 % x 1 Lt', categoria: 'AGROQUIMICO', unidadMedida: 'UNIDAD', alicuotaIva: 10.5 },
  { nombre: 'AGROQ BIOZYME TF CURASEMILLA x lt', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  // --- Inoculantes (19) ---
  { nombre: 'INOC. P/SILO DIASIL PASTURA x 300 g', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC. P/SILO DIASIL GRANO x 300 g', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOCUL+FUNG P/SOJA CRINIGAN P/800 KG', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC PACK P/TRIGO BAGUAL P/2000 kg', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC DUO P/TRIGO T + C p/1.000 Kgs', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC DUO P/TRIGO T + C + M p/1.000 Kgs', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOCULANTE DUO P/TRIGO BIO p/1.000 Kgs', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC DUO P/TRIGO TE + I p/2.000 Kgs', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC P/SOJA MIX SOJA (T+C) x P/2000 KG', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC P/SOJA MIX SOJA FULL (T+C+MET) P/2000 KG', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC P/SOJA MIX SOJA PCVR (T+C) P1000 KG', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC. PACK VIDASOJA BIO 1 P/4000 KG', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOCULANTE P/SILO SILOTRATO x 200 GS', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC. P/SOJA CREATE PACK FAST P/2000 KG', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOCUL P/SOJA P/1500 KG ENERGY PLUS LPU', categoria: 'INOCULANTE', unidadMedida: 'UNIDAD', alicuotaIva: 21 },
  { nombre: 'INOC. PACK ALFAVIDAS BIO 2 P/200 KG', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC. PACK ALFAVIDAS BIO 1 P/200 KG', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC. PACK VIDAVALE BIO 1 P/1000 KG', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'INOC PACK P/SOJA (T+C+MET) P/2000 kg', categoria: 'INOCULANTE', unidadMedida: 'KILO', alicuotaIva: 21 },
];

async function main() {
  for (const p of productosAgroquimicosYFertilizantes) {
    await prisma.producto.upsert({
      where: { nombre: p.nombre },
      update: {},
      create: p
    });
  }
  console.log(`✅ ${productosAgroquimicosYFertilizantes.length} productos sembrados (agroquímicos + fertilizantes)`);
}

main().finally(() => prisma.$disconnect());
```

Ejecutar:
```bash
npm run prisma:seed
```

**Nota:** las alícuotas de IVA son referenciales. AUT debe revisarlas y confirmarlas con el contador antes de operar en producción. La `unidadMedida` de varios ítems se infirió por heurística de texto (ver arriba) — conviene una pasada de revisión manual antes de producción, en particular los que quedaron como `UNIDAD` por no tener un sufijo de litros/kilos reconocible.

### 4. Frontend

```
frontend/src/features/productos/
├── api/productos.api.js
├── pages/
│   ├── ProductosListPage.jsx     # Lista con filtros (categoría, búsqueda)
│   └── ProductoFormPage.jsx       # Form crear/editar (solo ADMIN)
└── components/
    ├── ProductoCard.jsx
    └── CategoriaBadge.jsx
```

Lista en formato tabla para admin, formato card para portal productor (más visual).

---

## Tests

- ADMIN crea producto exitosamente.
- Productor (rol no admin) intenta crear → 403.
- Filtros funcionan (categoría, búsqueda, activo).
- No se puede desactivar producto si tiene campañas abiertas.

---

## Checklist de cierre

- [ ] Migración `add_productos` aplicada.
- [ ] Endpoints `/api/productos` operativos.
- [ ] Seed con ~10 productos típicos cargado.
- [ ] Frontend con listado filtrable y form de creación.
- [ ] Coverage ≥ 60%.
- [ ] Tag: `v0.3-fase-3-productos`.

---

## Próximo paso

[`09-FASE-4-CAMPANAS.md`](./09-FASE-4-CAMPANAS.md)
