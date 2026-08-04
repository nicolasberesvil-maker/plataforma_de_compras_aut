import { Router } from 'express';
import * as ctrl from './intenciones.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  crearIntencionSchema,
  actualizarIntencionSchema,
  descartarIntencionSchema,
  agruparIntencionesSchema,
  filtrosIntencionSchema
} from './intenciones.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/mias', requireRole(['PRODUCTOR']), ctrl.listarMias);
router.get('/tablero', requireRole(['ADMIN']), ctrl.tablero);
router.get('/', requireRole(['ADMIN']), validate(filtrosIntencionSchema, 'query'), ctrl.listar);
router.post('/', requireRole(['PRODUCTOR']), validate(crearIntencionSchema), ctrl.crear);
router.post('/agrupar', requireRole(['ADMIN']), validate(agruparIntencionesSchema), ctrl.agrupar);

router.get('/:id', requireRole(['PRODUCTOR', 'ADMIN']), ctrl.obtenerPorId);
router.patch('/:id', requireRole(['PRODUCTOR']), validate(actualizarIntencionSchema), ctrl.actualizar);
router.delete('/:id', requireRole(['PRODUCTOR']), ctrl.eliminar);
router.post('/:id/descartar', requireRole(['ADMIN']), validate(descartarIntencionSchema), ctrl.descartar);

export default router;
