import PDFDocument from 'pdfkit';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { env } from '../../config/env.js';

/**
 * Genera el PDF del comprobante interno y lo guarda en disco.
 * Devuelve la ruta del archivo (se persiste en Factura.pdfUrl).
 */
export async function generarPdfFactura(factura) {
  await fsPromises.mkdir(env.PDF_STORAGE_DIR, { recursive: true });
  const filePath = path.join(env.PDF_STORAGE_DIR, `factura-${factura.numero}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).text(`Factura ${factura.tipo}`, { align: 'right' });
    doc.fontSize(12).text(`N° ${factura.numero}`, { align: 'right' });
    doc.text(`Punto de venta: ${factura.puntoVenta}`, { align: 'right' });
    doc.text(`Fecha: ${new Date(factura.emitidaAt).toLocaleDateString('es-AR')}`, { align: 'right' });
    doc.moveDown(2);

    doc.fontSize(10).text('Emisor:', { underline: true });
    doc.text('Asociación Unión Tamberos');
    doc.text('Franck, Santa Fe');
    doc.moveDown();

    doc.text('Receptor:', { underline: true });
    doc.text(factura.ordenCompra.productor.razonSocial);
    doc.text(`CUIT: ${factura.ordenCompra.productor.cuit}`);
    doc.text(factura.ordenCompra.productor.domicilioFiscal);
    doc.moveDown(2);

    doc.text('Detalle:', { underline: true });
    doc.moveDown(0.5);

    for (const item of factura.items) {
      doc.text(item.descripcion);
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
