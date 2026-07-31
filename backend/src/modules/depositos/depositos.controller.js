import * as depositosService from './depositos.service.js';

export async function listar(req, res, next) {
  try {
    const depositos = await depositosService.listar(req.query);
    res.json({ data: depositos });
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const deposito = await depositosService.obtenerPorId(Number(req.params.id));
    res.json({ deposito });
  } catch (err) { next(err); }
}

export async function crear(req, res, next) {
  try {
    const deposito = await depositosService.crear(req.body);
    res.status(201).json({ deposito });
  } catch (err) { next(err); }
}

export async function actualizar(req, res, next) {
  try {
    const deposito = await depositosService.actualizar(Number(req.params.id), req.body);
    res.json({ deposito });
  } catch (err) { next(err); }
}

export async function desactivar(req, res, next) {
  try {
    await depositosService.desactivar(Number(req.params.id));
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function obtenerStock(req, res, next) {
  try {
    const stock = await depositosService.obtenerStock(Number(req.params.id));
    res.json({ data: stock });
  } catch (err) { next(err); }
}
