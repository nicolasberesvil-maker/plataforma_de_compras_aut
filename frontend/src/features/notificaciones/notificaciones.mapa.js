// Mapea el `tipo` de una notificación a la ruta del sidebar donde el usuario
// puede accionarla. Un tipo que no está en el mapa de su rol no suma badge
// (por ejemplo notificaciones dirigidas a ADMIN, que no tienen sidebar de rol).
export const MAPA_SECCIONES_PRODUCTOR = {
  CAMPANA_ABIERTA: '/productor',
  COMPRA_ACTUALIZADA: '/productor',
  CAMPANA_PROXIMA_A_CERRAR: '/productor',
  SOLICITUD_AGRUPADA: '/productor/mis-pedidos',
  SOLICITUD_DESCARTADA: '/productor/mis-pedidos',
  CAMPANA_CERRADA: '/productor/mis-pedidos',
  CAMPANA_CANCELADA: '/productor/mis-pedidos',
  ORDEN_GENERADA: '/productor/mis-ordenes',
  ENTREGA_EN_TRANSITO: '/productor/mis-entregas',
  ENTREGA_DISPONIBLE: '/productor/mis-entregas',
  ENTREGA_CONFIRMADA: '/productor/mis-entregas',
  FACTURA_EMITIDA: '/productor/mis-facturas',
  PAGO_CONFIRMADO: '/productor/mi-cuenta',
  PAGO_RECHAZADO: '/productor/mi-cuenta'
};

export const MAPA_SECCIONES_PROVEEDOR = {
  RFQ_RECIBIDO: '/proveedor',
  COTIZACION_RECHAZADA: '/proveedor/mis-cotizaciones',
  ENTREGA_EN_TRANSITO: '/proveedor/entregas',
  ENTREGA_DISPONIBLE: '/proveedor/entregas',
  ENTREGA_CONFIRMADA: '/proveedor/entregas'
};

export const MAPAS_POR_ROL = {
  PRODUCTOR: MAPA_SECCIONES_PRODUCTOR,
  PROVEEDOR: MAPA_SECCIONES_PROVEEDOR
};
