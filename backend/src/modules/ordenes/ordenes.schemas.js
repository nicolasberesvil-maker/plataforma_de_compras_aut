import { z } from 'zod';

export const definirFormaPagoSchema = z.object({
  formaPago: z.enum(['TRANSFERENCIA', 'ECHEQ_CORRIENTE', 'ECHEQ_PLAZO', 'TARJETA_AGRO', 'CANJE_CEREAL', 'CUENTA_CORRIENTE', 'EFECTIVO']),
  cuotas: z.number().int().positive().default(1)
});

export const filtrosOrdenSchema = z.object({
  estadoPago: z.enum(['PENDIENTE', 'PARCIAL', 'PAGADO', 'VENCIDO', 'CANCELADO']).optional(),
  campanaId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
