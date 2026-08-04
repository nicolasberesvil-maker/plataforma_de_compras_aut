import { Router } from 'express';
import * as ctrl from './pagos.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { crearPagoSchema, rechazarPagoSchema, filtrosPagoSchema } from './pagos.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/mios', requireRole(['PRODUCTOR']), ctrl.listarMios);
router.get('/', requireRole(['ADMIN']), validate(filtrosPagoSchema, 'query'), ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);

router.post('/', requireRole(['PRODUCTOR']), validate(crearPagoSchema), ctrl.crear);
router.patch('/:id/confirmar', requireRole(['ADMIN']), ctrl.confirmar);
router.patch('/:id/rechazar', requireRole(['ADMIN']), validate(rechazarPagoSchema), ctrl.rechazar);

export default router;
