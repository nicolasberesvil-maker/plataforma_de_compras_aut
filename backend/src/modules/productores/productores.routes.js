import { Router } from 'express';
import * as productoresController from './productores.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { listarProductoresSchema, actualizarProductorSchema, rechazarProductorSchema } from './productores.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/pendientes', requireRole(['ADMIN']), productoresController.listarPendientes);
router.get('/', requireRole(['ADMIN', 'CONTADOR']), validate(listarProductoresSchema, 'query'), productoresController.listar);
router.get('/:id', requireRole(['ADMIN', 'CONTADOR', 'PRODUCTOR']), productoresController.obtenerPorId);
router.patch('/:id', requireRole(['ADMIN', 'PRODUCTOR']), validate(actualizarProductorSchema), productoresController.actualizar);
router.patch('/:id/aprobar', requireRole(['ADMIN']), productoresController.aprobar);
router.patch('/:id/rechazar', requireRole(['ADMIN']), validate(rechazarProductorSchema), productoresController.rechazar);

export default router;
