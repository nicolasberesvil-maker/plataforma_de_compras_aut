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
  generarTandaSchema,
  completarRequisitosLicitacionSchema
} from './campanas.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', validate(filtrosCampanaSchema, 'query'), ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);
router.get('/:id/resumen', ctrl.obtenerResumen);

router.post('/', requireRole(['ADMIN']), validate(crearCampanaSchema), ctrl.crear);
router.patch('/:id', requireRole(['ADMIN']), validate(actualizarCampanaSchema), ctrl.actualizar);

router.post('/:id/abrir', requireRole(['ADMIN']), ctrl.abrir);
router.post('/:id/requisitos-licitacion', requireRole(['ADMIN']), validate(completarRequisitosLicitacionSchema), ctrl.completarRequisitosLicitacion);
router.post('/:id/cerrar-intenciones', requireRole(['ADMIN']), ctrl.cerrarIntenciones);
router.post('/:id/adjudicar-directa', requireRole(['ADMIN']), validate(adjudicarDirectaSchema), ctrl.adjudicarDirecta);
router.post('/:id/generar-tanda', requireRole(['ADMIN']), validate(generarTandaSchema), ctrl.generarTanda);
router.post('/:id/avisar-productores', requireRole(['ADMIN']), ctrl.avisarProductores);
router.post('/:id/cancelar', requireRole(['ADMIN']), validate(cancelarCampanaSchema), ctrl.cancelar);

export default router;
