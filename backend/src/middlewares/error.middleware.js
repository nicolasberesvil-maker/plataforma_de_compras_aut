import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  // Errores de Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: {
        code: 'UNIQUE_CONSTRAINT',
        message: 'Ya existe un registro con esos datos',
        details: err.meta
      }
    });
  }

  // Error no controlado
  logger.error({ err, path: req.path, method: req.method }, 'Error no controlado');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor'
    }
  });
}
