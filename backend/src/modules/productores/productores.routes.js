import { Router } from 'express';
import * as productoresController from './productores.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { listarProductoresSchema, crearProductorSchema, actualizarProductorSchema } from './productores.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(['ADMIN']), validate(listarProductoresSchema, 'query'), productoresController.listar);
router.post('/', requireRole(['ADMIN']), validate(crearProductorSchema), productoresController.crear);
router.get('/mi-cuenta', requireRole(['PRODUCTOR']), productoresController.miCuentaCorriente);
router.get('/:id', requireRole(['ADMIN', 'PRODUCTOR']), productoresController.obtenerPorId);
router.get('/:id/cuenta-corriente', requireRole(['ADMIN', 'PRODUCTOR']), productoresController.cuentaCorriente);
router.patch('/:id', requireRole(['ADMIN', 'PRODUCTOR']), validate(actualizarProductorSchema), productoresController.actualizar);

export default router;
