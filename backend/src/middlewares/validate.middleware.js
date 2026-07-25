import { ValidationError } from '../utils/errors.js';

/**
 * Valida req.body, req.query o req.params usando un schema de Zod.
 * @param {ZodSchema} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new ValidationError('Datos inválidos', result.error.format()));
    }
    req[source] = result.data;
    next();
  };
}
