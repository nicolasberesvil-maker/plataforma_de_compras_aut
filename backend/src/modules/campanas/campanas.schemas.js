import { z } from 'zod';

// volumenMinimo y fechaCierre son opcionales a nivel schema porque DIRECTA y
// CONTINUA no los requieren. La obligatoriedad de COLECTIVA se valida en el
// service (crear), donde ya conocemos el tipo y las reglas de negocio.
export const crearCampanaSchema = z.object({
  productoId: z.number().int().positive(),
  tipo: z.enum(['COLECTIVA', 'DIRECTA', 'CONTINUA']).default('COLECTIVA'),
  nombre: z.string().min(3).max(150),
  descripcion: z.string().max(2000).optional(),
  volumenMinimo: z.number().positive().optional(),
  volumenMaximo: z.number().positive().optional(),
  fechaApertura: z.coerce.date(),
  fechaCierre: z.coerce.date().optional(),
  fechaCierreCotizaciones: z.coerce.date().optional(),
  fechaEstimadaRecepcion: z.coerce.date().optional(),
  horasLockoutEdicion: z.number().int().nonnegative().default(0)
});

export const actualizarCampanaSchema = crearCampanaSchema.partial();

export const filtrosCampanaSchema = z.object({
  estado: z.enum(['BORRADOR', 'ABIERTA', 'EN_LICITACION', 'ADJUDICADA', 'CERRADA', 'CANCELADA']).optional(),
  tipo: z.enum(['COLECTIVA', 'DIRECTA', 'CONTINUA']).optional(),
  productoId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const cancelarCampanaSchema = z.object({
  motivo: z.string().min(5).max(500)
});

// Adjudicación directa (tipo DIRECTA): proveedor y precio ya conocidos.
export const adjudicarDirectaSchema = z.object({
  proveedorId: z.number().int().positive(),
  precioUnitario: z.number().positive(),
  moneda: z.enum(['ARS', 'USD']).default('ARS'),
  plazoEntregaDias: z.number().int().nonnegative(),
  condicionesPago: z.string().min(3).max(500)
});

// Disparo de tanda (tipo CONTINUA).
export const generarTandaSchema = z.object({
  tipoTanda: z.enum(['COLECTIVA', 'DIRECTA']).default('COLECTIVA'),
  fechaCierre: z.coerce.date().optional()
});
