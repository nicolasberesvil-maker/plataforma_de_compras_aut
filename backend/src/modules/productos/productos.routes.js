import { Router } from 'express';
import * as ctrl from './productos.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { crearProductoSchema, actualizarProductoSchema, filtrosProductoSchema } from './productos.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', validate(filtrosProductoSchema, 'query'), ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);

router.post('/', requireRole(['ADMIN']), validate(crearProductoSchema), ctrl.crear);
router.patch('/:id', requireRole(['ADMIN']), validate(actualizarProductoSchema), ctrl.actualizar);
router.delete('/:id', requireRole(['ADMIN']), ctrl.desactivar);

export default router;
