import { Router } from 'express';
import * as ctrl from './facturas.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { filtrosFacturaSchema } from './facturas.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/mias', requireRole(['PRODUCTOR']), ctrl.listarMias);
router.get('/', requireRole(['ADMIN']), validate(filtrosFacturaSchema, 'query'), ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);
router.get('/:id/pdf', ctrl.descargarPdf);

router.post('/generar/:ordenCompraId', requireRole(['ADMIN']), ctrl.generar);

export default router;
