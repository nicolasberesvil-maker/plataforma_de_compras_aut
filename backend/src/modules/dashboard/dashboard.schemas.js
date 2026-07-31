import { z } from 'zod';

export const filtrosFechaSchema = z.object({
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional()
});
