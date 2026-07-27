import * as productosService from './productos.service.js';

export async function listar(req, res, next) {
  try {
    const resultado = await productosService.listar(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const producto = await productosService.obtenerPorId(Number(req.params.id));
    res.json({ producto });
  } catch (err) { next(err); }
}

export async function crear(req, res, next) {
  try {
    const producto = await productosService.crear(req.body);
    res.status(201).json({ producto });
  } catch (err) { next(err); }
}

export async function actualizar(req, res, next) {
  try {
    const producto = await productosService.actualizar(Number(req.params.id), req.body);
    res.json({ producto });
  } catch (err) { next(err); }
}

export async function desactivar(req, res, next) {
  try {
    await productosService.desactivar(Number(req.params.id));
    res.status(204).send();
  } catch (err) { next(err); }
}
