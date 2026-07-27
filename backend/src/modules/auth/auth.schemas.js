import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  nombre: z.string().min(2).max(50),
  apellido: z.string().min(2).max(50),
  telefono: z.string().optional(),
  // Datos de productor
  razonSocial: z.string().min(2),
  cuit: z.string().regex(/^\d{11}$/, 'CUIT debe tener 11 dígitos'),
  condicionFiscal: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'EXENTO', 'CONSUMIDOR_FINAL']),
  domicilioFiscal: z.string().min(5),
  localidad: z.string().min(2)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  nuevaPassword: z.string().min(8).max(100)
});
