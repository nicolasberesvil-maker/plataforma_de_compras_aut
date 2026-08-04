import { z } from 'zod';

export const listarProveedoresSchema = z.object({
  estadoAprobacion: z.enum(['PENDIENTE', 'APROBADO', 'RECHAZADO', 'SUSPENDIDO']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const crearProveedorSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
  email: z.string().email(),
  nombre: z.string().min(2).max(50),
  apellido: z.string().min(2).max(50),
  telefono: z.string().optional(),
  razonSocial: z.string().min(2),
  cuit: z.string().regex(/^\d{11}$/, 'CUIT debe tener 11 dígitos'),
  condicionFiscal: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'EXENTO', 'CONSUMIDOR_FINAL']),
  domicilioFiscal: z.string().min(5),
  notasInternas: z.string().optional()
});

export const actualizarProveedorSchema = z.object({
  razonSocial: z.string().min(2).optional(),
  cuit: z.string().regex(/^\d{11}$/, 'CUIT debe tener 11 dígitos').optional(),
  condicionFiscal: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'EXENTO', 'CONSUMIDOR_FINAL']).optional(),
  domicilioFiscal: z.string().min(5).optional(),
  notasInternas: z.string().optional()
});

export const registrarPagoProveedorSchema = z.object({
  fecha: z.string().min(1),
  monto: z.number().positive(),
  medioPago: z.enum(['TRANSFERENCIA', 'ECHEQ_CORRIENTE', 'ECHEQ_PLAZO', 'TARJETA_AGRO', 'CANJE_CEREAL', 'CUENTA_CORRIENTE', 'EFECTIVO']),
  adjudicacionId: z.number().int().positive().optional(),
  observaciones: z.string().optional()
});
