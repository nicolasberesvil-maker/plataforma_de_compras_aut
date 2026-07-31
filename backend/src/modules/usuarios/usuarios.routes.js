import { Router } from 'express';
import * as usuariosController from './usuarios.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { listarUsuariosSchema, actualizarUsuarioSchema, cambiarPasswordSchema } from './usuarios.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(['ADMIN', 'CONTADOR']), validate(listarUsuariosSchema, 'query'), usuariosController.listar);
router.get('/:id', usuariosController.obtenerPorId);
router.patch('/:id', validate(actualizarUsuarioSchema), usuariosController.actualizar);
router.patch('/:id/activar', requireRole(['ADMIN', 'CONTADOR']), usuariosController.activar);
router.patch('/:id/desactivar', requireRole(['ADMIN', 'CONTADOR']), usuariosController.desactivar);
router.post('/:id/cambiar-password', validate(cambiarPasswordSchema), usuariosController.cambiarPassword);

export default router;
