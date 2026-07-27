import { z } from 'zod';

const CATEGORIAS = ['AGROQUIMICO', 'FERTILIZANTE', 'SEMILLA', 'INOCULANTE', 'NUTRICION_ANIMAL', 'SANIDAD_ANIMAL', 'OTRO'];
const UNIDADES = ['LITRO', 'KILO', 'UNIDAD', 'TONELADA', 'BOLSA'];

export const crearProductoSchema = z.object({
  nombre: z.string().min(2).max(150),
  descripcion: z.string().max(1000).optional(),
  categoria: z.enum(CATEGORIAS),
  unidadMedida: z.enum(UNIDADES),
  alicuotaIva: z.number().positive().max(50)
});

export const actualizarProductoSchema = crearProductoSchema.partial();

export const filtrosProductoSchema = z.object({
  categoria: z.enum(CATEGORIAS).optional(),
  activo: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
