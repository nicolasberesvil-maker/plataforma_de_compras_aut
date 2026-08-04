import { Router } from 'express';
import * as proveedoresController from './proveedores.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import {
  listarProveedoresSchema, crearProveedorSchema, actualizarProveedorSchema, registrarPagoProveedorSchema
} from './proveedores.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(['ADMIN']), validate(listarProveedoresSchema, 'query'), proveedoresController.listar);
router.post('/', requireRole(['ADMIN']), validate(crearProveedorSchema), proveedoresController.crear);
router.get('/mi-cuenta', requireRole(['PROVEEDOR']), proveedoresController.miCuenta);
router.get('/:id', requireRole(['ADMIN', 'PROVEEDOR']), proveedoresController.obtenerPorId);
router.get('/:id/cuenta-corriente', requireRole(['ADMIN', 'PROVEEDOR']), proveedoresController.cuentaCorriente);
router.post('/:id/pagos', requireRole(['ADMIN']), validate(registrarPagoProveedorSchema), proveedoresController.crearPago);
router.patch('/:id', requireRole(['ADMIN']), validate(actualizarProveedorSchema), proveedoresController.actualizar);
router.patch('/:id/aprobar', requireRole(['ADMIN']), proveedoresController.aprobar);
router.patch('/:id/suspender', requireRole(['ADMIN']), proveedoresController.suspender);

export default router;
