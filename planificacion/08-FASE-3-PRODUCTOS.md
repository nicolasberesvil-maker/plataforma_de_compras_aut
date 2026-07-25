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

### 3. Seed de productos iniciales

`backend/prisma/seed.js`:

```javascript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const productosIniciales = [
  { nombre: 'Glifosato 48%', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'Atrazina 50%', categoria: 'AGROQUIMICO', unidadMedida: 'LITRO', alicuotaIva: 10.5 },
  { nombre: 'Urea granulada', categoria: 'FERTILIZANTE', unidadMedida: 'TONELADA', alicuotaIva: 10.5 },
  { nombre: 'Semilla Maíz Híbrido', categoria: 'SEMILLA', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'Semilla Soja RR', categoria: 'SEMILLA', unidadMedida: 'BOLSA', alicuotaIva: 10.5 },
  { nombre: 'Semilla Trigo', categoria: 'SEMILLA', unidadMedida: 'KILO', alicuotaIva: 10.5 },
  { nombre: 'Inoculante para soja', categoria: 'INOCULANTE', unidadMedida: 'LITRO', alicuotaIva: 21 },
  { nombre: 'Núcleo vitamínico bovinos', categoria: 'NUTRICION_ANIMAL', unidadMedida: 'KILO', alicuotaIva: 21 },
  { nombre: 'Vacuna aftosa', categoria: 'SANIDAD_ANIMAL', unidadMedida: 'UNIDAD', alicuotaIva: 21 }
];

async function main() {
  for (const p of productosIniciales) {
    await prisma.producto.upsert({
      where: { nombre: p.nombre },
      update: {},
      create: p
    });
  }
  console.log('✅ Productos sembrados');
}

main().finally(() => prisma.$disconnect());
```

Ejecutar:
```bash
npm run prisma:seed
```

**Nota:** las alícuotas de IVA son referenciales. AUT debe revisarlas y confirmarlas con el contador antes de operar en producción.

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
