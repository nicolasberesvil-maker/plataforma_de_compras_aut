import { Router } from 'express';
import * as ctrl from './adjudicaciones.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { adjudicarSchema, filtrosAdjudicacionSchema } from './adjudicaciones.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(['ADMIN', 'OPERADOR', 'CONTADOR']), validate(filtrosAdjudicacionSchema, 'query'), ctrl.listar);
router.get('/comparador/:campanaId', requireRole(['ADMIN', 'CONTADOR']), ctrl.obtenerComparador);
router.get('/campana/:campanaId', requireRole(['ADMIN', 'OPERADOR', 'CONTADOR']), ctrl.obtenerPorCampana);
router.get('/:id', requireRole(['ADMIN', 'OPERADOR', 'CONTADOR']), ctrl.obtenerPorId);

router.post('/', requireRole(['ADMIN', 'CONTADOR']), validate(adjudicarSchema), ctrl.adjudicar);

export default router;
