import { Router } from 'express';
import * as ctrl from './remitos.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { crearRemitoSchema } from './remitos.schemas.js';

// mergeParams: se monta en /api/campanas/:campanaId/remitos (ver app.js).
const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(requireRole(['ADMIN', 'OPERADOR_DEPOSITO']));

router.get('/', ctrl.listar);
router.post('/', validate(crearRemitoSchema), ctrl.crear);

export default router;
