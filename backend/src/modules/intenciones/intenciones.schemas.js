import { z } from 'zod';

const MODALIDAD_ENTREGA = ['RETIRO_EN_DEPOSITO', 'ENTREGA_EN_CAMPO'];
const FORMA_PAGO = [
  'TRANSFERENCIA', 'ECHEQ_CORRIENTE', 'ECHEQ_PLAZO',
  'TARJETA_AGRO', 'CANJE_CEREAL', 'CUENTA_CORRIENTE', 'EFECTIVO'
];

const camposComunes = {
  volumen: z.number().positive(),
  observaciones: z.string().max(1000).optional(),
  fechaDeseada: z.coerce.date().optional(),
  modalidadEntregaPreferida: z.enum(MODALIDAD_ENTREGA).optional(),
  // depositoPreferidoId se agrega en Fase 8 (recién ahí existe el modelo Deposito).
  direccionEntregaCampo: z.string().min(5).optional(),
  formaPagoPreferida: z.enum(FORMA_PAGO).optional()
};

// Un solo endpoint para los dos caminos de la regla D.1: si viene campanaId es
// el camino top-down (intención dentro de una campaña abierta); si no viene,
// es un pedido suelto bottom-up y entonces productoId, fechaDeseada y
// modalidadEntregaPreferida pasan a ser obligatorios porque son los únicos
// datos que tiene el ADMIN para decidir cómo armar el requerimiento.
export const crearIntencionSchema = z.object({
  campanaId: z.number().int().positive().optional(),
  productoId: z.number().int().positive().optional(),
  ...camposComunes
}).superRefine((d, ctx) => {
  if (!d.campanaId) {
    if (!d.productoId) {
      ctx.addIssue({ code: 'custom', message: 'Indicá qué producto necesitás', path: ['productoId'] });
    }
    if (!d.fechaDeseada) {
      ctx.addIssue({ code: 'custom', message: 'Indicá para cuándo lo necesitás', path: ['fechaDeseada'] });
    }
    if (!d.modalidadEntregaPreferida) {
      ctx.addIssue({ code: 'custom', message: 'Indicá cómo preferís recibirlo', path: ['modalidadEntregaPreferida'] });
    }
  }
  if (d.modalidadEntregaPreferida === 'ENTREGA_EN_CAMPO' && !d.direccionEntregaCampo) {
    ctx.addIssue({ code: 'custom', message: 'La dirección es obligatoria para entrega en campo', path: ['direccionEntregaCampo'] });
  }
});

export const actualizarIntencionSchema = z.object(camposComunes).partial();

export const descartarIntencionSchema = z.object({
  motivo: z.string().min(5).max(500)
});

// Agrupar N pedidos sueltos (mismo producto) en una Campana COLECTIVA nueva.
// fechaCierre viene pre-cargada en el frontend a "ahora + 48hs" (sugerencia
// del negocio, DECISIONES-PENDIENTES.md #3) pero es editable acá.
export const agruparIntencionesSchema = z.object({
  intencionIds: z.array(z.number().int().positive()).min(1),
  nombre: z.string().min(3).max(150),
  fechaCierre: z.coerce.date(),
  fechaEstimadaRecepcion: z.coerce.date().optional(),
  volumenMinimo: z.number().positive().optional(),
  volumenMaximo: z.number().positive().optional(),
  horasLockoutEdicion: z.number().int().nonnegative().default(0)
});

export const filtrosIntencionSchema = z.object({
  estado: z.enum(['PENDIENTE', 'AGRUPADA', 'DESCARTADA']).optional(),
  productoId: z.coerce.number().int().positive().optional(),
  soloSueltas: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
