import { Router } from 'express';
import * as ctrl from './ordenes.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { definirFormaPagoSchema, filtrosOrdenSchema } from './ordenes.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/mias', requireRole(['PRODUCTOR']), ctrl.listarMias);
router.get('/', requireRole(['ADMIN', 'OPERADOR', 'CONTADOR']), validate(filtrosOrdenSchema, 'query'), ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);

router.patch('/:id/forma-pago', validate(definirFormaPagoSchema), ctrl.definirFormaPago);
router.post('/:id/marcar-pagada', requireRole(['ADMIN', 'CONTADOR']), ctrl.marcarPagada);

export default router;
