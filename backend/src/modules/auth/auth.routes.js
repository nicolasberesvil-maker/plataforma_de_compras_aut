import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from './auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schemas.js';

const router = Router();

// Rate limit estricto en endpoints sensibles
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Esperá 15 minutos.' } }
});

// Mismo límite que login: es un endpoint sensible que se podría usar para
// enumerar emails registrados o para spamear la casilla de otra persona.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Esperá 15 minutos.' } }
});

router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', forgotPasswordLimiter, validate(resetPasswordSchema), authController.resetPassword);

export default router;
