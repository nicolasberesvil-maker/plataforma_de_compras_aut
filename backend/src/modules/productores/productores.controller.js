import { prisma } from '../../config/database.js';
import { ForbiddenError } from '../../utils/errors.js';
import * as productoresService from './productores.service.js';
import { obtenerCuentaCorriente } from './productores.cuenta-corriente.js';
import * as pagosService from '../pagos/pagos.service.js';

export async function listar(req, res, next) {
  try {
    const resultado = await productoresService.listar(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function crear(req, res, next) {
  try {
    const { usuario, productor } = await productoresService.crear(req.body);
    res.status(201).json({
      productor,
      usuario: { id: usuario.id, username: usuario.username, email: usuario.email }
    });
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const productor = await productoresService.obtenerPorId(Number(req.params.id), req.usuario);
    res.json({ productor });
  } catch (err) { next(err); }
}

export async function actualizar(req, res, next) {
  try {
    const productor = await productoresService.actualizar(Number(req.params.id), req.body, req.usuario);
    res.json({ productor });
  } catch (err) { next(err); }
}

export async function cuentaCorriente(req, res, next) {
  try {
    const id = Number(req.params.id);
    await productoresService.obtenerPorId(id, req.usuario);
    const cuentaCorriente = await obtenerCuentaCorriente(id);
    res.json(cuentaCorriente);
  } catch (err) { next(err); }
}

/** "Mi cuenta" del portal productor: cuenta corriente (Fase 8) + historial de pagos (M5) juntos. */
export async function miCuentaCorriente(req, res, next) {
  try {
    const productor = await prisma.productor.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!productor) throw new ForbiddenError('Usuario no es productor');

    const [cuentaCorriente, pagos] = await Promise.all([
      obtenerCuentaCorriente(productor.id),
      pagosService.listarMios(req.usuario.id)
    ]);

    res.json({ ...cuentaCorriente, pagos });
  } catch (err) { next(err); }
}
