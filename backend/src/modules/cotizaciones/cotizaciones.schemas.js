import { z } from 'zod';

export const crearCotizacionSchema = z.object({
  campanaId: z.number().int().positive(),
  // Precio de contado (regla D.3): base para calcular cualquier financiación.
  precioUnitario: z.number().positive(),
  monedaPrecio: z.enum(['ARS', 'USD']).default('ARS'),
  plazoEntregaDias: z.number().int().positive(),
  // % mensual para pago financiado. Opcional: hay proveedores que solo venden de contado.
  tasaInteresMensual: z.number().min(0).max(50).optional(),
  condicionesPago: z.string().min(5).max(2000),
  observaciones: z.string().max(2000).optional(),
  validaHasta: z.coerce.date()
});

export const actualizarCotizacionSchema = crearCotizacionSchema.partial().omit({ campanaId: true });
