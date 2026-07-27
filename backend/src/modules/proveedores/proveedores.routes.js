import { Router } from 'express';
import * as proveedoresController from './proveedores.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { listarProveedoresSchema, crearProveedorSchema, actualizarProveedorSchema } from './proveedores.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(['ADMIN', 'CONTADOR']), validate(listarProveedoresSchema, 'query'), proveedoresController.listar);
router.post('/', requireRole(['ADMIN']), validate(crearProveedorSchema), proveedoresController.crear);
router.get('/:id', requireRole(['ADMIN', 'CONTADOR', 'PROVEEDOR']), proveedoresController.obtenerPorId);
router.patch('/:id', requireRole(['ADMIN']), validate(actualizarProveedorSchema), proveedoresController.actualizar);
router.patch('/:id/aprobar', requireRole(['ADMIN']), proveedoresController.aprobar);
router.patch('/:id/suspender', requireRole(['ADMIN']), proveedoresController.suspender);

export default router;
