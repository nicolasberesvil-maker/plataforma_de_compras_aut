import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';
import { generarPdfFactura } from './facturas.pdf.js';

// Alícuota referencial de percepción IIBB Santa Fe (a confirmar real con AUT, ver DECISIONES-PENDIENTES.md).
const ALICUOTA_PERCEPCION_IIBB = 0.025;

const INCLUDE_DETALLE = {
  items: { include: { producto: true } },
  ordenCompra: { include: { productor: true } }
};

export async function generarParaOrden(ordenCompraId) {
  const factura = await prisma.$transaction(async (tx) => {
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

    // Tipo de factura según condición fiscal del productor (regla de negocio del Bloque B).
    const tipo = orden.productor.condicionFiscal === 'RESPONSABLE_INSCRIPTO' ? 'A' : 'B';

    // Numeración interna correlativa por tipo (independiente entre A y B).
    const ultima = await tx.factura.findFirst({ where: { tipo }, orderBy: { id: 'desc' } });
    const proximoNumero = (ultima ? parseInt(ultima.numero.split('-')[1], 10) : 0) + 1;
    const numero = `${tipo}-${String(proximoNumero).padStart(8, '0')}`;

    const subtotalNeto = Number(orden.subtotal);
    const iva = Number(orden.iva);

    // Percepción IIBB Santa Fe: solo aplica a RI (Factura A) domiciliados en Santa Fe.
    const esSantaFe = orden.productor.domicilioFiscal.toLowerCase().includes('santa fe');
    const percepcionesIIBB = tipo === 'A' && esSantaFe ? subtotalNeto * ALICUOTA_PERCEPCION_IIBB : 0;

    const total = subtotalNeto + iva + percepcionesIIBB;
    const producto = orden.adjudicacion.campana.producto;

    return tx.factura.create({
      data: {
        ordenCompraId: orden.id,
        tipo,
        numero,
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
      include: INCLUDE_DETALLE
    });
  });

  // El PDF se genera fuera de la transacción (I/O de archivo, no debe bloquear la DB).
  const pdfUrl = await generarPdfFactura(factura);
  const facturaConPdf = await prisma.factura.update({
    where: { id: factura.id },
    data: { pdfUrl },
    include: INCLUDE_DETALLE
  });

  eventBus.emit('FACTURA_EMITIDA', {
    facturaId: facturaConPdf.id,
    ordenId: facturaConPdf.ordenCompraId,
    productorId: facturaConPdf.ordenCompra.productorId,
    total: Number(facturaConPdf.total)
  });

  return facturaConPdf;
}

export async function listarMias(usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) throw new ForbiddenError();

  return prisma.factura.findMany({
    where: { ordenCompra: { productorId: productor.id } },
    include: INCLUDE_DETALLE,
    orderBy: { emitidaAt: 'desc' }
  });
}

export async function listar({ tipo, page = 1, limit = 50 }) {
  const where = {};
  if (tipo) where.tipo = tipo;

  const [data, total] = await Promise.all([
    prisma.factura.findMany({
      where,
      include: INCLUDE_DETALLE,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { emitidaAt: 'desc' }
    }),
    prisma.factura.count({ where })
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function obtenerPorId(id, usuario) {
  const factura = await prisma.factura.findUnique({ where: { id }, include: INCLUDE_DETALLE });
  if (!factura) throw new NotFoundError('Factura');

  if (usuario.rol === 'PRODUCTOR') {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: usuario.id } });
    if (!productor || factura.ordenCompra.productorId !== productor.id) throw new ForbiddenError();
  } else if (!['ADMIN'].includes(usuario.rol)) {
    throw new ForbiddenError();
  }

  return factura;
}
