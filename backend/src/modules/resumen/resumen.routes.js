import { Router } from 'express';
import * as ctrl from './resumen.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { filtrosResumenSchema } from './resumen.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/pedidos', requireRole(['ADMIN', 'PRODUCTOR']), validate(filtrosResumenSchema, 'query'), ctrl.pedidos);

export default router;
