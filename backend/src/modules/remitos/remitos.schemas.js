import { z } from 'zod';

export const crearRemitoSchema = z.object({
  proveedorId: z.number().int().positive(),
  depositoId: z.number().int().positive(),
  numero: z.string().min(1).max(50),
  fecha: z.coerce.date(),
  cantidadRecibida: z.number().positive(),
  observaciones: z.string().max(1000).optional(),
  adjuntoUrl: z.string().url().optional()
});
