import { Router } from 'express';
import * as ctrl from './cotizaciones.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { crearCotizacionSchema, actualizarCotizacionSchema, crearCotizacionLoteSchema } from './cotizaciones.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/mias', requireRole(['PROVEEDOR']), ctrl.listarMias);
router.get('/campanas', requireRole(['PROVEEDOR']), ctrl.listarCampanasParaCotizar);
router.get('/:id', ctrl.obtenerPorId);

router.post('/', requireRole(['PROVEEDOR']), validate(crearCotizacionSchema), ctrl.crear);
router.post('/lote', requireRole(['PROVEEDOR']), validate(crearCotizacionLoteSchema), ctrl.crearLote);
router.patch('/:id', requireRole(['PROVEEDOR']), validate(actualizarCotizacionSchema), ctrl.actualizar);
router.delete('/:id', requireRole(['PROVEEDOR']), ctrl.eliminar);

export default router;
