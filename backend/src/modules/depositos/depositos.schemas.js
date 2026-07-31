import { z } from 'zod';

export const crearDepositoSchema = z.object({
  nombre: z.string().min(2).max(150),
  localidad: z.string().min(2).max(150),
  direccion: z.string().min(2).max(255),
  responsable: z.string().max(150).optional(),
  telefonoContacto: z.string().max(50).optional(),
  horarioAtencion: z.string().max(150).optional(),
  capacidadMaxima: z.number().positive().optional()
});

export const actualizarDepositoSchema = crearDepositoSchema.partial();

export const filtrosDepositoSchema = z.object({
  // z.coerce.boolean() trataría el string "false" como true (Boolean("false") === true).
  activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional()
});
