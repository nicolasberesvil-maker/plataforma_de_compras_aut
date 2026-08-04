import * as remitosService from './remitos.service.js';

export async function listar(req, res, next) {
  try {
    const remitos = await remitosService.listar(Number(req.params.campanaId));
    res.json({ data: remitos });
  } catch (err) { next(err); }
}

export async function crear(req, res, next) {
  try {
    const remito = await remitosService.crear(Number(req.params.campanaId), req.body, req.usuario.id);
    res.status(201).json({ remito });
  } catch (err) { next(err); }
}
