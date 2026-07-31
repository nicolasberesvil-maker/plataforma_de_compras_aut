import { prisma } from '../../config/database.js';
import { ForbiddenError } from '../../utils/errors.js';

const DIAS_ACTIVIDAD_PRODUCTOR = 30;

function filtroFecha(campo, { desde, hasta } = {}) {
  if (!desde && !hasta) return {};
  const rango = {};
  if (desde) rango.gte = new Date(desde);
  if (hasta) rango.lte = new Date(hasta);
  return { [campo]: rango };
}

function haceNDias(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export async function obtenerKpis(filtros = {}) {
  const [
    totalCampanas,
    campanasActivas,
    totalAdjudicaciones,
    totalOrdenes,
    ahorroTotal,
    volumenYMonto,
    productoresActivos,
    productoresTotales
  ] = await Promise.all([
    prisma.campana.count({ where: filtroFecha('createdAt', filtros) }),
    prisma.campana.count({ where: { ...filtroFecha('createdAt', filtros), estado: { in: ['ABIERTA', 'EN_LICITACION'] } } }),
    prisma.adjudicacion.count({ where: filtroFecha('adjudicadaAt', filtros) }),
    prisma.ordenCompra.count({ where: filtroFecha('createdAt', filtros) }),
    prisma.adjudicacion.aggregate({ where: filtroFecha('adjudicadaAt', filtros), _sum: { ahorroEstimadoTotal: true } }),
    prisma.ordenCompra.aggregate({ where: filtroFecha('createdAt', filtros), _sum: { volumenFinal: true, total: true } }),
    prisma.productor.count({
      where: { aprobado: true, usuario: { activo: true, ultimoLoginAt: { gte: haceNDias(DIAS_ACTIVIDAD_PRODUCTOR) } } }
    }),
    prisma.productor.count({ where: { aprobado: true } })
  ]);

  return {
    campanas: { total: totalCampanas, activas: campanasActivas },
    adjudicaciones: totalAdjudicaciones,
    ordenes: totalOrdenes,
    ahorroAcumulado: Number(ahorroTotal._sum.ahorroEstimadoTotal ?? 0),
    volumenAcumulado: Number(volumenYMonto._sum.volumenFinal ?? 0),
    montoAcumulado: Number(volumenYMonto._sum.total ?? 0),
    tasaAdopcion: productoresTotales > 0
      ? { activos: productoresActivos, total: productoresTotales, porcentaje: (productoresActivos / productoresTotales) * 100 }
      : { activos: 0, total: 0, porcentaje: 0 }
  };
}

export async function obtenerVolumenPorInsumo(filtros = {}) {
  const ordenes = await prisma.ordenCompra.findMany({
    where: filtroFecha('createdAt', filtros),
    include: { adjudicacion: { include: { campana: { include: { producto: true } } } } }
  });

  const agrupado = ordenes.reduce((acc, orden) => {
    const producto = orden.adjudicacion.campana.producto;
    if (!acc[producto.id]) {
      acc[producto.id] = {
        productoId: producto.id,
        nombre: producto.nombre,
        unidadMedida: producto.unidadMedida,
        volumenTotal: 0,
        montoTotal: 0
      };
    }
    acc[producto.id].volumenTotal += Number(orden.volumenFinal);
    acc[producto.id].montoTotal += Number(orden.total);
    return acc;
  }, {});

  return Object.values(agrupado).sort((a, b) => b.montoTotal - a.montoTotal);
}

export async function obtenerRankingProveedores(filtros = {}) {
  const adjudicaciones = await prisma.adjudicacion.findMany({
    where: filtroFecha('adjudicadaAt', filtros),
    include: { cotizacionGanadora: { include: { proveedor: { select: { id: true, razonSocial: true } } } } }
  });

  const agrupado = adjudicaciones.reduce((acc, adj) => {
    const prov = adj.cotizacionGanadora?.proveedor;
    if (!prov) return acc;
    if (!acc[prov.id]) {
      acc[prov.id] = { proveedorId: prov.id, razonSocial: prov.razonSocial, campanasGanadas: 0, volumenAdjudicado: 0 };
    }
    acc[prov.id].campanasGanadas += 1;
    acc[prov.id].volumenAdjudicado += Number(adj.volumenTotalAdjudicado);
    return acc;
  }, {});

  return Object.values(agrupado).sort((a, b) => b.campanasGanadas - a.campanasGanadas);
}

export async function obtenerTopProductores({ limit = 10 } = {}) {
  const agrupado = await prisma.ordenCompra.groupBy({
    by: ['productorId'],
    _sum: { total: true, volumenFinal: true },
    _count: true,
    orderBy: { _sum: { total: 'desc' } },
    take: limit
  });

  const productores = await prisma.productor.findMany({ where: { id: { in: agrupado.map((p) => p.productorId) } } });

  return agrupado.map((p) => ({
    productorId: p.productorId,
    razonSocial: productores.find((d) => d.id === p.productorId)?.razonSocial ?? null,
    totalCompras: Number(p._sum.total ?? 0),
    volumenTotal: Number(p._sum.volumenFinal ?? 0),
    cantidadOrdenes: p._count
  }));
}

export async function obtenerBalanceIva(filtros = {}) {
  const [facturas, adjudicaciones] = await Promise.all([
    prisma.factura.aggregate({ where: filtroFecha('emitidaAt', filtros), _sum: { iva: true } }),
    prisma.adjudicacion.findMany({
      where: filtroFecha('adjudicadaAt', filtros),
      include: { campana: { include: { producto: true } } }
    })
  ]);

  const ivaDebito = Number(facturas._sum.iva ?? 0);
  const ivaCredito = adjudicaciones.reduce((sum, adj) => {
    const alicuota = Number(adj.campana.producto.alicuotaIva) / 100;
    return sum + Number(adj.volumenTotalAdjudicado) * Number(adj.precioFinalUnitario) * alicuota;
  }, 0);

  return {
    ivaDebito,
    ivaCredito,
    saldo: ivaCredito - ivaDebito,
    nota: 'Valores estimados en v1 (sin integración AFIP). La fuente fiscal definitiva es BIT.'
  };
}

export async function obtenerFormasPagoFrecuentes() {
  const agrupado = await prisma.ordenCompra.groupBy({
    by: ['formaPago'],
    _count: true,
    _sum: { total: true },
    where: { formaPago: { not: null } }
  });

  return agrupado
    .map((o) => ({ formaPago: o.formaPago, cantidad: o._count, montoTotal: Number(o._sum.total ?? 0) }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

export async function obtenerMiDashboard(usuarioId) {
  const productor = await prisma.productor.findUnique({ where: { usuarioId } });
  if (!productor) throw new ForbiddenError();

  const [ordenes, proximaEntrega] = await Promise.all([
    prisma.ordenCompra.aggregate({
      where: { productorId: productor.id },
      _count: true,
      _sum: { total: true, volumenFinal: true, ahorroEstimado: true }
    }),
    prisma.entrega.findFirst({
      where: {
        productorId: productor.id,
        estado: { in: ['PENDIENTE', 'EN_TRANSITO', 'DISPONIBLE_PARA_RETIRO', 'EN_RUTA_A_CAMPO'] }
      },
      // Entrega.fechaEstimada nunca se completa en ningún lado del código (Fase 9
      // no llegó a calcularla), así que ordenar por ese campo no ordena nada.
      // createdAt es el mejor proxy disponible: la orden más vieja pendiente es
      // la que más urge resolver.
      orderBy: { createdAt: 'asc' },
      include: { deposito: true, ordenCompra: { include: { adjudicacion: { include: { campana: { include: { producto: true } } } } } } }
    })
  ]);

  return {
    cantidadOrdenes: ordenes._count,
    totalGastado: Number(ordenes._sum.total ?? 0),
    volumenTotal: Number(ordenes._sum.volumenFinal ?? 0),
    // Ya viene prorrateado por orden (ver adjudicaciones.service.js materializarAdjudicacion):
    // ahorroEstimadoOrden = ahorroEstimadoTotal / volumenTotalAdjudicado * volumenFinal.
    ahorroAcumulado: Number(ordenes._sum.ahorroEstimado ?? 0),
    proximaEntrega
  };
}
