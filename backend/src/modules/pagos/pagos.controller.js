import * as pagosService from './pagos.service.js';

export async function crear(req, res, next) {
  try {
    const pago = await pagosService.crear(req.body, req.usuario);
    res.status(201).json({ pago });
  } catch (err) { next(err); }
}

export async function listarMios(req, res, next) {
  try {
    const pagos = await pagosService.listarMios(req.usuario.id);
    res.json({ data: pagos });
  } catch (err) { next(err); }
}

export async function listar(req, res, next) {
  try {
    const resultado = await pagosService.listar(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const pago = await pagosService.obtenerPorId(Number(req.params.id), req.usuario);
    res.json({ pago });
  } catch (err) { next(err); }
}

export async function confirmar(req, res, next) {
  try {
    const pago = await pagosService.confirmar(Number(req.params.id));
    res.json({ pago });
  } catch (err) { next(err); }
}

export async function rechazar(req, res, next) {
  try {
    const pago = await pagosService.rechazar(Number(req.params.id), req.body.motivo);
    res.json({ pago });
  } catch (err) { next(err); }
}
