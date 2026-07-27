import * as productoresService from './productores.service.js';

export async function listar(req, res, next) {
  try {
    const resultado = await productoresService.listar(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function listarPendientes(req, res, next) {
  try {
    const productores = await productoresService.listarPendientes();
    res.json({ data: productores });
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

export async function aprobar(req, res, next) {
  try {
    const productor = await productoresService.aprobar(Number(req.params.id));
    res.json({ productor });
  } catch (err) { next(err); }
}

export async function rechazar(req, res, next) {
  try {
    await productoresService.rechazar(Number(req.params.id), req.body.motivo);
    res.status(204).send();
  } catch (err) { next(err); }
}
