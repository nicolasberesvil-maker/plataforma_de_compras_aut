import * as adjudicacionesService from './adjudicaciones.service.js';

export async function obtenerComparador(req, res, next) {
  try {
    const comparador = await adjudicacionesService.obtenerComparador(Number(req.params.campanaId));
    res.json(comparador);
  } catch (err) { next(err); }
}

export async function adjudicar(req, res, next) {
  try {
    const adjudicacion = await adjudicacionesService.adjudicar(req.body);
    res.status(201).json({ adjudicacion });
  } catch (err) { next(err); }
}

export async function listar(req, res, next) {
  try {
    const resultado = await adjudicacionesService.listar(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const adjudicacion = await adjudicacionesService.obtenerPorId(Number(req.params.id));
    res.json({ adjudicacion });
  } catch (err) { next(err); }
}

export async function obtenerPorCampana(req, res, next) {
  try {
    const adjudicacion = await adjudicacionesService.obtenerPorCampana(Number(req.params.campanaId));
    res.json({ adjudicacion });
  } catch (err) { next(err); }
}
