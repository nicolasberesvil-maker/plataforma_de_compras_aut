import * as ordenesService from './ordenes.service.js';

export async function listarMias(req, res, next) {
  try {
    const ordenes = await ordenesService.listarMias(req.usuario.id);
    res.json({ ordenes });
  } catch (err) { next(err); }
}

export async function listar(req, res, next) {
  try {
    const resultado = await ordenesService.listar(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const orden = await ordenesService.obtenerPorId(Number(req.params.id), req.usuario);
    res.json({ orden });
  } catch (err) { next(err); }
}

export async function definirFormaPago(req, res, next) {
  try {
    const orden = await ordenesService.definirFormaPago(Number(req.params.id), req.body, req.usuario);
    res.json({ orden });
  } catch (err) { next(err); }
}

export async function marcarPagada(req, res, next) {
  try {
    const orden = await ordenesService.marcarPagada(Number(req.params.id));
    res.json({ orden });
  } catch (err) { next(err); }
}
