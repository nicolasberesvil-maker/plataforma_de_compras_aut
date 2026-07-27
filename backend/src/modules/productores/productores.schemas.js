import { z } from 'zod';

export const listarProductoresSchema = z.object({
  aprobado: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const actualizarProductorSchema = z.object({
  razonSocial: z.string().min(2).optional(),
  cuit: z.string().regex(/^\d{11}$/, 'CUIT debe tener 11 dígitos').optional(),
  condicionFiscal: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'EXENTO', 'CONSUMIDOR_FINAL']).optional(),
  domicilioFiscal: z.string().min(5).optional(),
  localidad: z.string().min(2).optional()
});

export const rechazarProductorSchema = z.object({
  motivo: z.string().min(3).optional()
});
