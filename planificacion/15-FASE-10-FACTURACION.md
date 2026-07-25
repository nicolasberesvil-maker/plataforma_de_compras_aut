# Fase 10 — Facturación (Comprobantes Internos)

> **Sprint:** 11 (1 semana)
> **Objetivo:** Emitir comprobantes internos por cada orden, generar PDF descargable y centralizar para exportar a BIT.

---

## Contexto

**En v1 NO se integra con AFIP.** Generamos comprobantes internos con numeración propia. El equipo contable de AUT exporta y carga manualmente en BIT. La integración con AFIP (CAE) queda para v2.

**Reglas fiscales** (recordatorio del cuestionario, Bloque B):
- IVA: 21% (estándar) o 10,5% (algunos agro/fertilizantes), depende del producto.
- Productores RI → Factura A. Monotributistas → Factura B.
- AUT es agente de percepción IIBB Santa Fe. Hay que calcularla y agregarla a la factura.
- Otras percepciones/retenciones se evalúan caso por caso (LPG, RG 830) → fuera de scope v1.

---

## Resultado esperado

- ADMIN/CONTADOR genera factura para una orden de compra (1:1).
- Tipo (A/B) se decide automáticamente según condición fiscal del productor.
- Numeración interna correlativa por punto de venta.
- Se calcula subtotal, IVA, percepciones IIBB y total.
- Se genera PDF descargable.
- Productor descarga sus facturas desde portal.

---

## Prerrequisitos

- Fase 9 completa.

---

## Tareas

### 1. Schema Prisma

Agregar modelos `Factura` e `ItemFactura`. Migrar:

```bash
npx prisma migrate dev --name add_facturas
```

### 2. Dependencia para PDFs

```bash
cd backend
npm install pdfkit
```

### 3. Módulo `facturas`

```
backend/src/modules/facturas/
├── facturas.controller.js
├── facturas.service.js
├── facturas.routes.js
├── facturas.schemas.js
├── facturas.pdf.js            # Generador de PDF
└── facturas.test.js
```

#### `facturas.service.js`

```javascript
import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';
import { generarPdfFactura } from './facturas.pdf.js';

// Alícuota referencial de percepción IIBB Santa Fe (a configurar real con AUT)
const ALICUOTA_PERCEPCION_IIBB = 0.025; // 2,5% — ejemplo, confirmar real

export async function generarParaOrden(ordenCompraId, usuarioId) {
  return prisma.$transaction(async (tx) => {
    // Validar que la orden existe y no tenga factura
    const orden = await tx.ordenCompra.findUnique({
      where: { id: ordenCompraId },
      include: {
        productor: true,
        adjudicacion: { include: { campana: { include: { producto: true } } } },
        factura: true
      }
    });

    if (!orden) throw new NotFoundError('Orden');
    if (orden.factura) throw new ConflictError('La orden ya tiene factura emitida');

    // Tipo de factura según condición fiscal del productor
    const tipo = orden.productor.condicionFiscal === 'RESPONSABLE_INSCRIPTO' ? 'A' : 'B';

    // Generar número interno correlativo
    const ultimo = await tx.factura.findFirst({
      where: { tipo },
      orderBy: { id: 'desc' }
    });
    const proximoNumero = (ultimo ? parseInt(ultimo.numero.split('-')[1] || 0) : 0) + 1;
    const numero = `${tipo}-${String(proximoNumero).padStart(8, '0')}`;

    // Cálculos
    const subtotalNeto = Number(orden.subtotal);
    const iva = Number(orden.iva);

    // Percepciones IIBB solo si productor es RI y de Santa Fe
    let percepcionesIIBB = 0;
    if (tipo === 'A' && orden.productor.domicilioFiscal.toLowerCase().includes('santa fe')) {
      percepcionesIIBB = subtotalNeto * ALICUOTA_PERCEPCION_IIBB;
    }

    const total = subtotalNeto + iva + percepcionesIIBB;

    // Crear factura
    const producto = orden.adjudicacion.campana.producto;
    const factura = await tx.factura.create({
      data: {
        ordenCompraId: orden.id,
        tipo,
        numero,
        puntoVenta: '0001',
        subtotalNeto,
        iva,
        percepcionesIIBB: percepcionesIIBB || null,
        total,
        items: {
          create: [{
            productoId: producto.id,
            descripcion: producto.nombre,
            cantidad: orden.volumenFinal,
            precioUnitario: orden.precioUnitario,
            alicuotaIva: producto.alicuotaIva,
            subtotal: subtotalNeto
          }]
        }
      },
      include: { items: true, ordenCompra: { include: { productor: true } } }
    });

    return factura;
  }).then(async (factura) => {
    // Generar PDF post-transacción
    const pdfUrl = await generarPdfFactura(factura);
    await prisma.factura.update({
      where: { id: factura.id },
      data: { pdfUrl }
    });

    eventBus.emit('FACTURA_EMITIDA', {
      facturaId: factura.id,
      ordenId: factura.ordenCompraId,
      productorId: factura.ordenCompra.productorId,
      total: Number(factura.total)
    });

    return factura;
  });
}

export async function listarMias(usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) throw new ForbiddenError();

  return prisma.factura.findMany({
    where: { ordenCompra: { productorId: productor.id } },
    include: {
      items: true,
      ordenCompra: { include: { adjudicacion: { include: { campana: true } } } }
    },
    orderBy: { emitidaAt: 'desc' }
  });
}

export async function listar({ tipo, page = 1, limit = 50 }) {
  const where = {};
  if (tipo) where.tipo = tipo;

  const [data, total] = await Promise.all([
    prisma.factura.findMany({
      where,
      include: {
        items: true,
        ordenCompra: { include: { productor: true } }
      },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { emitidaAt: 'desc' }
    }),
    prisma.factura.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id, usuario) {
  const factura = await prisma.factura.findUnique({
    where: { id },
    include: {
      items: { include: { producto: true } },
      ordenCompra: { include: { productor: true } }
    }
  });
  if (!factura) throw new NotFoundError('Factura');

  if (usuario.rol === 'PRODUCTOR') {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: usuario.id } });
    if (factura.ordenCompra.productorId !== productor.id) throw new ForbiddenError();
  }

  return factura;
}
```

#### `facturas.pdf.js`

```javascript
import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import path from 'path';

const STORAGE_DIR = process.env.PDF_STORAGE_DIR || './storage/facturas';

export async function generarPdfFactura(factura) {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const filePath = path.join(STORAGE_DIR, `factura-${factura.numero}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = require('fs').createWriteStream(filePath);
    doc.pipe(stream);

    // Encabezado
    doc.fontSize(20).text(`Factura ${factura.tipo}`, { align: 'right' });
    doc.fontSize(12).text(`Nº ${factura.numero}`, { align: 'right' });
    doc.text(`Punto de venta: ${factura.puntoVenta}`, { align: 'right' });
    doc.text(`Fecha: ${new Date(factura.emitidaAt).toLocaleDateString('es-AR')}`, { align: 'right' });
    doc.moveDown(2);

    // Datos del emisor (AUT)
    doc.fontSize(10).text('Emisor:', { underline: true });
    doc.text('Asociación Unión Tamberos');
    doc.text('CUIT: XX-XXXXXXXX-X');
    doc.text('Franck, Santa Fe');
    doc.moveDown();

    // Datos del receptor
    doc.text('Receptor:', { underline: true });
    doc.text(factura.ordenCompra.productor.razonSocial);
    doc.text(`CUIT: ${factura.ordenCompra.productor.cuit}`);
    doc.text(factura.ordenCompra.productor.domicilioFiscal);
    doc.moveDown(2);

    // Tabla de items
    doc.text('Detalle:', { underline: true });
    doc.moveDown(0.5);

    for (const item of factura.items) {
      doc.text(`${item.descripcion}`);
      doc.text(`Cantidad: ${item.cantidad} × $${Number(item.precioUnitario).toFixed(4)} = $${Number(item.subtotal).toFixed(2)}`);
      doc.moveDown(0.5);
    }

    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Subtotal neto: $${Number(factura.subtotalNeto).toFixed(2)}`, { align: 'right' });
    doc.text(`IVA: $${Number(factura.iva).toFixed(2)}`, { align: 'right' });
    if (factura.percepcionesIIBB) {
      doc.text(`Percepción IIBB: $${Number(factura.percepcionesIIBB).toFixed(2)}`, { align: 'right' });
    }
    doc.fontSize(14).text(`Total: $${Number(factura.total).toFixed(2)}`, { align: 'right' });
    doc.moveDown(2);

    doc.fontSize(8).text('Comprobante interno. No válido como factura electrónica AFIP.', { align: 'center' });

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}
```

#### `facturas.controller.js`

```javascript
import fs from 'fs';
import * as facturasService from './facturas.service.js';

export async function generar(req, res, next) {
  try {
    const factura = await facturasService.generarParaOrden(Number(req.params.ordenCompraId), req.usuario.id);
    res.status(201).json(factura);
  } catch (err) { next(err); }
}

export async function listarMias(req, res, next) {
  try {
    res.json(await facturasService.listarMias(req.usuario.id));
  } catch (err) { next(err); }
}

export async function listar(req, res, next) {
  try {
    res.json(await facturasService.listar(req.query));
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    res.json(await facturasService.obtenerPorId(Number(req.params.id), req.usuario));
  } catch (err) { next(err); }
}

export async function descargarPdf(req, res, next) {
  try {
    const factura = await facturasService.obtenerPorId(Number(req.params.id), req.usuario);
    if (!factura.pdfUrl) throw new NotFoundError('PDF no generado');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="factura-${factura.numero}.pdf"`);
    fs.createReadStream(factura.pdfUrl).pipe(res);
  } catch (err) { next(err); }
}
```

### 4. Frontend: facturas

```
frontend/src/features/facturas/
├── api/facturas.api.js
├── pages/
│   ├── MisFacturasPage.jsx
│   ├── FacturasAdminPage.jsx
│   └── FacturaDetailPage.jsx
└── components/
    ├── FacturaCard.jsx
    └── BotonGenerarFactura.jsx
```

---

## Aclaraciones importantes para AUT

Antes de habilitar en producción, AUT debe confirmar con su contador:

1. **Alícuota real de percepción IIBB Santa Fe** (en este código se usa 2,5% como placeholder).
2. **CUIT exacto de AUT** y punto de venta interno.
3. **Datos legales completos del emisor** para los PDFs.
4. **Si en v1 se aceptan otras percepciones/retenciones** (canje cereal, LPG) o queda para v2.

---

## Tests

- Generar factura para orden sin factura previa → 201.
- Generar factura dos veces para misma orden → 409.
- Productor RI → tipo A.
- Productor Monotributo → tipo B.
- Cálculo IVA y percepciones IIBB correcto.
- Numeración correlativa por tipo.

---

## Checklist de cierre

- [ ] Migración `add_facturas` aplicada.
- [ ] Endpoints `/api/facturas/*` operativos.
- [ ] PDFs se generan y descargan correctamente.
- [ ] Tipo de factura se decide bien según condición fiscal.
- [ ] Notificación `FACTURA_EMITIDA` llega al productor.
- [ ] Coverage ≥ 60%.
- [ ] Tag: `v0.10-fase-10-facturacion`.

---

## Próximo paso

[`16-FASE-11-DASHBOARD.md`](./16-FASE-11-DASHBOARD.md)
