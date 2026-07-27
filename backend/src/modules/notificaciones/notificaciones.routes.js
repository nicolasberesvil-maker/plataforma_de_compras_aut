import { Router } from 'express';
import * as ctrl from './notificaciones.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listar);
router.get('/no-leidas/count', ctrl.contarNoLeidas);
router.patch('/:id/leida', ctrl.marcarComoLeida);

export default router;
