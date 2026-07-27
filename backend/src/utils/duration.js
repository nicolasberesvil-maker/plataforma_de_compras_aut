const UNIDADES_A_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/**
 * Convierte duraciones tipo "15m", "7d", "30s" (el mismo formato que usa
 * `jsonwebtoken` para `expiresIn`) a milisegundos, para poder aplicar la
 * misma configuración a cosas que no son JWT (fecha de expiración en BD,
 * `maxAge` de cookie).
 */
export function parseDuracionMs(duracion) {
  const match = /^(\d+)(s|m|h|d)$/.exec(duracion);
  if (!match) throw new Error(`Formato de duración inválido: "${duracion}"`);

  const [, cantidad, unidad] = match;
  return Number(cantidad) * UNIDADES_A_MS[unidad];
}
