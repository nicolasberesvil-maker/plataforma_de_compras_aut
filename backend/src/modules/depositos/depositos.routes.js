import { Router } from 'express';
import * as ctrl from './depositos.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { crearDepositoSchema, actualizarDepositoSchema, filtrosDepositoSchema } from './depositos.schemas.js';

const router = Router();

router.use(authenticate);

// Lectura: también el operador de depósito la necesita para elegir depósito
// destino al despachar una entrega (ver EntregaRow.jsx en el frontend).
router.get('/', requireRole(['ADMIN', 'CONTADOR', 'OPERADOR_DEPOSITO']), validate(filtrosDepositoSchema, 'query'), ctrl.listar);
router.get('/:id', requireRole(['ADMIN', 'CONTADOR', 'OPERADOR_DEPOSITO']), ctrl.obtenerPorId);
router.get('/:id/stock', requireRole(['ADMIN', 'CONTADOR', 'OPERADOR_DEPOSITO']), ctrl.obtenerStock);

// Alta/edición/baja de depósitos: ADMIN y CONTADOR (CONTADOR = administrador para este sistema).
router.post('/', requireRole(['ADMIN', 'CONTADOR']), validate(crearDepositoSchema), ctrl.crear);
router.patch('/:id', requireRole(['ADMIN', 'CONTADOR']), validate(actualizarDepositoSchema), ctrl.actualizar);
router.delete('/:id', requireRole(['ADMIN', 'CONTADOR']), ctrl.desactivar);

export default router;
