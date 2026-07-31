import { Router } from 'express';
import * as ctrl from './stock.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ingresoSchema, ajusteSchema, transferenciaSchema, filtrosMovimientoSchema } from './stock.schemas.js';

const router = Router();

router.use(authenticate);
router.use(requireRole(['ADMIN', 'CONTADOR']));

router.get('/', validate(filtrosMovimientoSchema, 'query'), ctrl.listarMovimientos);
router.post('/ingresos', validate(ingresoSchema), ctrl.registrarIngreso);
router.post('/ajustes', validate(ajusteSchema), ctrl.registrarAjuste);
router.post('/transferencias', validate(transferenciaSchema), ctrl.registrarTransferencia);

export default router;
