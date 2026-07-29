import { z } from 'zod';

export const adjudicarSchema = z.object({
  campanaId: z.number().int().positive(),
  cotizacionGanadoraId: z.number().int().positive(),
  // Referencia opcional para calcular el ahorro (regla D.4). Si no se carga, queda null.
  precioMinoristaReferencia: z.number().positive().optional(),
  motivoEleccion: z.string().max(2000).optional()
});

export const filtrosAdjudicacionSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
