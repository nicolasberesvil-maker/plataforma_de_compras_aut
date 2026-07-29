import { Router } from 'express';
import * as ctrl from './adjudicaciones.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { adjudicarSchema, filtrosAdjudicacionSchema } from './adjudicaciones.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(['ADMIN', 'OPERADOR']), validate(filtrosAdjudicacionSchema, 'query'), ctrl.listar);
router.get('/comparador/:campanaId', requireRole(['ADMIN']), ctrl.obtenerComparador);
router.get('/campana/:campanaId', requireRole(['ADMIN', 'OPERADOR']), ctrl.obtenerPorCampana);
router.get('/:id', requireRole(['ADMIN', 'OPERADOR']), ctrl.obtenerPorId);

router.post('/', requireRole(['ADMIN']), validate(adjudicarSchema), ctrl.adjudicar);

export default router;
