import { Router } from 'express';
import * as ctrl from './dashboard.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { filtrosFechaSchema } from './dashboard.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/mi', requireRole(['PRODUCTOR']), ctrl.miDashboard);

router.use(requireRole(['ADMIN', 'CONTADOR']));
router.get('/kpis', validate(filtrosFechaSchema, 'query'), ctrl.kpis);
router.get('/volumen-por-insumo', validate(filtrosFechaSchema, 'query'), ctrl.volumenPorInsumo);
router.get('/ranking-proveedores', validate(filtrosFechaSchema, 'query'), ctrl.rankingProveedores);
router.get('/top-productores', ctrl.topProductores);
router.get('/balance-iva', validate(filtrosFechaSchema, 'query'), ctrl.balanceIva);
router.get('/formas-pago', ctrl.formasPago);
router.get('/export', validate(filtrosFechaSchema, 'query'), ctrl.exportarExcel);

export default router;
