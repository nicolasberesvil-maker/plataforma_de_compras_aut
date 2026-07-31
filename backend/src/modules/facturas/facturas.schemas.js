import { z } from 'zod';

export const filtrosFacturaSchema = z.object({
  tipo: z.enum(['A', 'B']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50)
});
