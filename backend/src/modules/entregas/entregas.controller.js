import * as entregasService from './entregas.service.js';

export async function listarMias(req, res, next) {
  try {
    const entregas = await entregasService.listarMias(req.usuario.id);
    res.json({ entregas });
  } catch (err) { next(err); }
}

export async function listar(req, res, next) {
  try {
    const resultado = await entregasService.listar(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const entrega = await entregasService.obtenerPorId(Number(req.params.id), req.usuario);
    res.json({ entrega });
  } catch (err) { next(err); }
}

export async function marcarEnTransito(req, res, next) {
  try {
    const entrega = await entregasService.marcarEnTransito(Number(req.params.id), req.body);
    res.json({ entrega });
  } catch (err) { next(err); }
}

export async function marcarDisponible(req, res, next) {
  try {
    const entrega = await entregasService.marcarDisponible(Number(req.params.id), req.body);
    res.json({ entrega });
  } catch (err) { next(err); }
}

export async function confirmarRetiro(req, res, next) {
  try {
    const entrega = await entregasService.confirmarRetiro(Number(req.params.id), req.body, req.usuario.id);
    res.json({ entrega });
  } catch (err) { next(err); }
}

export async function confirmarEntregaCampo(req, res, next) {
  try {
    const entrega = await entregasService.confirmarEntregaCampo(Number(req.params.id), req.body, req.usuario);
    res.json({ entrega });
  } catch (err) { next(err); }
}

export async function cancelar(req, res, next) {
  try {
    const entrega = await entregasService.cancelar(Number(req.params.id), req.body.motivo);
    res.json({ entrega });
  } catch (err) { next(err); }
}
