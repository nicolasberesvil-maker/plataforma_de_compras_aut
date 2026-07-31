import { z } from 'zod';

export const filtrosEntregaSchema = z.object({
  depositoId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['PENDIENTE', 'EN_TRANSITO', 'DISPONIBLE_PARA_RETIRO', 'EN_RUTA_A_CAMPO', 'ENTREGADA', 'CANCELADA']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

// depositoId es obligatorio recién al confirmar disponibilidad para retiro
// (RETIRO_EN_DEPOSITO); en marcar-en-transito es opcional porque en ese
// momento puede que todavía no se haya decidido a qué depósito va.
export const marcarEnTransitoSchema = z.object({
  depositoId: z.number().int().positive().optional()
});

export const marcarDisponibleSchema = z.object({
  depositoId: z.number().int().positive().optional()
});

export const confirmarRetiroSchema = z.object({
  recibidaPorNombre: z.string().min(2),
  recibidaPorDni: z.string().min(6),
  observaciones: z.string().optional()
});

export const confirmarEntregaCampoSchema = z.object({
  recibidaPorNombre: z.string().min(2).optional(),
  recibidaPorDni: z.string().min(6).optional(),
  observaciones: z.string().optional()
});

export const cancelarEntregaSchema = z.object({
  motivo: z.string().min(5, 'El motivo de cancelación es obligatorio')
});
