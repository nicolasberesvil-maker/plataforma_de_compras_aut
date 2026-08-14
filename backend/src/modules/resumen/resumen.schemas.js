import { z } from 'zod';

export const filtrosResumenSchema = z.object({
  search: z.string().optional(),
  estado: z.string().optional(),
  productoId: z.coerce.number().int().positive().optional(),
  loteId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
