import { Router } from 'express';
import * as ctrl from './depositos.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { crearDepositoSchema, actualizarDepositoSchema, filtrosDepositoSchema } from './depositos.schemas.js';

const router = Router();

router.use(authenticate);
router.use(requireRole(['ADMIN']));

router.get('/', validate(filtrosDepositoSchema, 'query'), ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);
router.get('/:id/stock', ctrl.obtenerStock);

router.post('/', validate(crearDepositoSchema), ctrl.crear);
router.patch('/:id', validate(actualizarDepositoSchema), ctrl.actualizar);
router.delete('/:id', ctrl.desactivar);

export default router;
