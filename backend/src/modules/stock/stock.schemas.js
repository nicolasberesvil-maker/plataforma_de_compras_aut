import { z } from 'zod';

export const ingresoSchema = z.object({
  depositoId: z.number().int().positive(),
  productoId: z.number().int().positive(),
  cantidad: z.number().positive(),
  proveedorOrigen: z.string().optional(),
  observaciones: z.string().optional()
});

export const ajusteSchema = z.object({
  depositoId: z.number().int().positive(),
  productoId: z.number().int().positive(),
  diferencia: z.number(),
  observaciones: z.string().min(10, 'Las observaciones son obligatorias para ajustes')
});

export const transferenciaSchema = z.object({
  depositoOrigenId: z.number().int().positive(),
  depositoDestinoId: z.number().int().positive(),
  productoId: z.number().int().positive(),
  cantidad: z.number().positive(),
  observaciones: z.string().optional()
});

export const filtrosMovimientoSchema = z.object({
  depositoId: z.coerce.number().int().positive().optional(),
  productoId: z.coerce.number().int().positive().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50)
});
