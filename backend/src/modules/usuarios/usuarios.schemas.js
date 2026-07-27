import { z } from 'zod';

export const listarUsuariosSchema = z.object({
  rol: z.enum(['PRODUCTOR', 'PROVEEDOR', 'ADMIN', 'OPERADOR', 'CONTADOR', 'OPERADOR_DEPOSITO']).optional(),
  activo: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(2).max(50).optional(),
  apellido: z.string().min(2).max(50).optional(),
  telefono: z.string().optional(),
  rol: z.enum(['PRODUCTOR', 'PROVEEDOR', 'ADMIN', 'OPERADOR', 'CONTADOR', 'OPERADOR_DEPOSITO']).optional()
});

export const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1),
  passwordNueva: z.string().min(8).max(100)
});
