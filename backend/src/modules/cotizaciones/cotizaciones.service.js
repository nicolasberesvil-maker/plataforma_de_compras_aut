import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors.js';
import { eventBus } from '../../services/event-bus.service.js';

export async function listarMias(usuarioId) {
  const proveedor = await obtenerProveedorDelUsuario(usuarioId);

  return prisma.cotizacion.findMany({
    where: { proveedorId: proveedor.id },
    include: { campana: { include: { producto: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Lista campañas en EN_LICITACION para el proveedor.
 * Incluye solo info pública: producto, volumen consolidado, fecha límite, condiciones.
 * NO incluye intenciones individuales (regla C.6, sobre cerrado).
 */
export async function listarCampanasParaCotizar(usuarioId) {
  const proveedor = await obtenerProveedorDelUsuario(usuarioId);
  if (proveedor.estadoAprobacion !== 'APROBADO') {
    throw new ForbiddenError('Proveedor no aprobado');
  }

  const campanas = await prisma.campana.findMany({
    where: {
      estado: 'EN_LICITACION',
      OR: [{ fechaCierreCotizaciones: null }, { fechaCierreCotizaciones: { gt: new Date() } }]
    },
    include: { producto: true, lote: true }
  });

  return Promise.all(campanas.map(async (campana) => {
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
      loteId: campana.loteId,
      lote: campana.lote,
      volumenConsolidado: Number(stats._sum.volumen ?? 0),
      cantidadProductores: stats._count,
      fechaCierreCotizaciones: campana.fechaCierreCotizaciones,
      yaCotice: !!miCotizacion,
      miCotizacion: miCotizacion || null
    };
  }));
}

export async function obtenerPorId(id, usuario) {
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    include: { campana: { include: { producto: true } }, proveedor: true }
  });
  if (!cotizacion) throw new NotFoundError('Cotización');

  // Solo ve su cotización; admin/operador la ve toda.
  if (usuario.rol === 'PROVEEDOR') {
    const proveedor = await obtenerProveedorDelUsuario(usuario.id);
    if (cotizacion.proveedorId !== proveedor.id) throw new ForbiddenError();
  }

  // Sobre cerrado (regla C.6): los destinos de entrega recién se muestran al
  // proveedor cuando ganó — antes no debe saber quiénes son los productores.
  if (cotizacion.esGanadora) {
    const intenciones = await prisma.intencionCompra.findMany({
      where: { campanaId: cotizacion.campanaId },
      include: { productor: { select: { razonSocial: true, localidad: true } } }
    });
    cotizacion.destinos = intenciones.map((i) => ({
      productor: i.productor.razonSocial,
      volumen: Number(i.volumen),
      modalidadEntregaPreferida: i.modalidadEntregaPreferida,
      direccionEntregaCampo: i.direccionEntregaCampo,
      localidad: i.productor.localidad
    }));
  }

  return cotizacion;
}

async function crearUna(datos, proveedor) {
  const campana = await prisma.campana.findUnique({ where: { id: datos.campanaId } });
  if (!campana) throw new NotFoundError('Campaña');
  if (campana.estado !== 'EN_LICITACION') {
    throw new ConflictError('La campaña no está en licitación');
  }
  if (campana.fechaCierreCotizaciones && new Date() > campana.fechaCierreCotizaciones) {
    throw new ConflictError('El plazo para cotizar venció');
  }

  const existente = await prisma.cotizacion.findUnique({
    where: { campanaId_proveedorId: { campanaId: campana.id, proveedorId: proveedor.id } }
  });
  if (existente) throw new ConflictError('Ya cotizaste esta campaña. Editá la existente.');

  return prisma.cotizacion.create({
    data: {
      campanaId: campana.id,
      proveedorId: proveedor.id,
      precioUnitario: datos.precioUnitario,
      monedaPrecio: datos.monedaPrecio,
      plazoEntregaDias: datos.plazoEntregaDias,
      tasaInteresMensual: datos.tasaInteresMensual,
      condicionesPago: datos.condicionesPago,
      observaciones: datos.observaciones,
      validaHasta: datos.validaHasta
    },
    include: { campana: { include: { producto: true } } }
  });
}

export async function crear(datos, usuarioId) {
  const proveedor = await obtenerProveedorDelUsuario(usuarioId);
  if (proveedor.estadoAprobacion !== 'APROBADO') {
    throw new ForbiddenError('Proveedor no aprobado');
  }

  const cotizacion = await crearUna(datos, proveedor);

  eventBus.emit('COTIZACION_RECIBIDA', {
    cotizacionId: cotizacion.id,
    campanaId: cotizacion.campanaId,
    proveedorId: proveedor.id
  });

  return cotizacion;
}

/**
 * Cotiza N campañas de un lote en un solo llamado. Best-effort por ítem, no
 * todo-o-nada: cada Cotizacion es independiente bajo el
 * @@unique([campanaId, proveedorId]) existente, así que si un producto ya
 * fue cotizado o su campaña venció no debe bloquear al resto del lote.
 */
export async function crearLote(datos, usuarioId) {
  const proveedor = await obtenerProveedorDelUsuario(usuarioId);
  if (proveedor.estadoAprobacion !== 'APROBADO') {
    throw new ForbiddenError('Proveedor no aprobado');
  }

  const creadas = [];
  const errores = [];
  for (const item of datos.items) {
    try {
      const cotizacion = await crearUna({ ...datos, campanaId: item.campanaId, precioUnitario: item.precioUnitario }, proveedor);
      creadas.push(cotizacion);
    } catch (err) {
      errores.push({ campanaId: item.campanaId, motivo: err.message });
    }
  }

  for (const c of creadas) {
    eventBus.emit('COTIZACION_RECIBIDA', { cotizacionId: c.id, campanaId: c.campanaId, proveedorId: proveedor.id });
  }

  return { creadas, errores };
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
      tasaInteresMensual: datos.tasaInteresMensual,
      condicionesPago: datos.condicionesPago,
      observaciones: datos.observaciones,
      validaHasta: datos.validaHasta
    },
    include: { campana: { include: { producto: true } } }
  });
}

export async function eliminar(id, usuarioId) {
  const cotizacion = await prisma.cotizacion.findUnique({ where: { id }, include: { campana: true } });
  if (!cotizacion) throw new NotFoundError('Cotización');

  const proveedor = await obtenerProveedorDelUsuario(usuarioId);
  if (cotizacion.proveedorId !== proveedor.id) throw new ForbiddenError();

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
