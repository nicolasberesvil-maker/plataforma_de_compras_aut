import { verifyAccessToken } from '../modules/auth/auth.service.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

/**
 * Verifica el access token y carga req.usuario.
 * Si falla, responde 401.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Token requerido'));
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.usuario = {
      id: payload.usuarioId,
      rol: payload.rol,
      email: payload.email
    };
    next();
  } catch {
    next(new UnauthorizedError('Token inválido o expirado'));
  }
}

/**
 * Verifica que el usuario tenga uno de los roles permitidos.
 * Uso: router.get('/x', authenticate, requireRole(['ADMIN']), handler)
 */
export function requireRole(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) return next(new UnauthorizedError());
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(new ForbiddenError(`Requiere rol: ${rolesPermitidos.join(' o ')}`));
    }
    next();
  };
}
