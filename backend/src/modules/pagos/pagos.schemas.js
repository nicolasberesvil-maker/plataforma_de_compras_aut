import { z } from 'zod';

const FORMAS_PAGO = ['TRANSFERENCIA', 'ECHEQ_CORRIENTE', 'ECHEQ_PLAZO', 'TARJETA_AGRO', 'CANJE_CEREAL', 'CUENTA_CORRIENTE', 'EFECTIVO'];

export const crearPagoSchema = z.object({
  // Solo lo usa el ADMIN al cargar un pago en nombre de un productor; el
  // PRODUCTOR siempre declara sobre su propia cuenta (se ignora si lo manda).
  productorId: z.number().int().positive().optional(),
  fecha: z.coerce.date().optional(),
  observaciones: z.string().max(1000).optional(),
  aplicaciones: z.array(z.object({
    ordenCompraId: z.number().int().positive(),
    montoAplicado: z.number().positive()
  })).min(1, 'Elegí al menos una orden')
    .refine((apps) => new Set(apps.map((a) => a.ordenCompraId)).size === apps.length, {
      message: 'No repitas la misma orden en un pago'
    }),
  medios: z.array(z.object({
    formaPago: z.enum(FORMAS_PAGO),
    monto: z.number().positive()
  })).min(1, 'Elegí al menos un medio de pago')
});

export const rechazarPagoSchema = z.object({
  motivo: z.string().min(1, 'Indicá el motivo del rechazo')
});

export const filtrosPagoSchema = z.object({
  estado: z.enum(['DECLARADO', 'CONFIRMADO', 'RECHAZADO']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
