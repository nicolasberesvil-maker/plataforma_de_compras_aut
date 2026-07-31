import { Router } from 'express';
import * as ctrl from './entregas.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  filtrosEntregaSchema,
  marcarEnTransitoSchema,
  marcarDisponibleSchema,
  confirmarRetiroSchema,
  confirmarEntregaCampoSchema,
  cancelarEntregaSchema
} from './entregas.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/mias', requireRole(['PRODUCTOR']), ctrl.listarMias);
router.get('/', requireRole(['ADMIN', 'CONTADOR', 'OPERADOR_DEPOSITO']), validate(filtrosEntregaSchema, 'query'), ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);

router.patch('/:id/en-transito', requireRole(['ADMIN', 'CONTADOR']), validate(marcarEnTransitoSchema), ctrl.marcarEnTransito);
router.patch('/:id/disponible', requireRole(['ADMIN', 'CONTADOR', 'OPERADOR_DEPOSITO']), validate(marcarDisponibleSchema), ctrl.marcarDisponible);
router.patch('/:id/confirmar-retiro', requireRole(['ADMIN', 'CONTADOR', 'OPERADOR_DEPOSITO']), validate(confirmarRetiroSchema), ctrl.confirmarRetiro);
router.patch('/:id/confirmar-entrega-campo', requireRole(['ADMIN', 'CONTADOR', 'PRODUCTOR']), validate(confirmarEntregaCampoSchema), ctrl.confirmarEntregaCampo);
router.patch('/:id/cancelar', requireRole(['ADMIN', 'CONTADOR']), validate(cancelarEntregaSchema), ctrl.cancelar);

export default router;
