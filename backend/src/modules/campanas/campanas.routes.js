import { Router } from 'express';
import * as ctrl from './campanas.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  crearCampanaSchema,
  actualizarCampanaSchema,
  filtrosCampanaSchema,
  cancelarCampanaSchema,
  adjudicarDirectaSchema,
  generarTandaSchema
} from './campanas.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', validate(filtrosCampanaSchema, 'query'), ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);
router.get('/:id/resumen', ctrl.obtenerResumen);

router.post('/', requireRole(['ADMIN', 'CONTADOR']), validate(crearCampanaSchema), ctrl.crear);
router.patch('/:id', requireRole(['ADMIN', 'CONTADOR']), validate(actualizarCampanaSchema), ctrl.actualizar);

router.post('/:id/abrir', requireRole(['ADMIN', 'CONTADOR']), ctrl.abrir);
router.post('/:id/cerrar-intenciones', requireRole(['ADMIN', 'CONTADOR']), ctrl.cerrarIntenciones);
router.post('/:id/adjudicar-directa', requireRole(['ADMIN', 'CONTADOR']), validate(adjudicarDirectaSchema), ctrl.adjudicarDirecta);
router.post('/:id/generar-tanda', requireRole(['ADMIN', 'CONTADOR']), validate(generarTandaSchema), ctrl.generarTanda);
router.post('/:id/cancelar', requireRole(['ADMIN', 'CONTADOR']), validate(cancelarCampanaSchema), ctrl.cancelar);

export default router;
