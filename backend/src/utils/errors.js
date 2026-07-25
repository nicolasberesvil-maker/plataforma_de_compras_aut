export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, details) { super(message, 400, 'VALIDATION_ERROR', details); }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado') { super(message, 401, 'UNAUTHORIZED'); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Sin permisos') { super(message, 403, 'FORBIDDEN'); }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso') { super(`${resource} no encontrado`, 404, 'NOT_FOUND'); }
}

export class ConflictError extends AppError {
  constructor(message, details) { super(message, 409, 'CONFLICT', details); }
}
