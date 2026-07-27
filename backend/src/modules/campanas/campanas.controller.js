import * as campanasService from './campanas.service.js';

export async function listar(req, res, next) {
  try {
    const resultado = await campanasService.listar(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const campana = await campanasService.obtenerPorId(Number(req.params.id));
    res.json({ campana });
  } catch (err) { next(err); }
}

export async function obtenerResumen(req, res, next) {
  try {
    const resumen = await campanasService.obtenerResumen(Number(req.params.id), req.usuario);
    res.json({ resumen });
  } catch (err) { next(err); }
}

export async function crear(req, res, next) {
  try {
    const campana = await campanasService.crear(req.body, req.usuario);
    res.status(201).json({ campana });
  } catch (err) { next(err); }
}

export async function actualizar(req, res, next) {
  try {
    const campana = await campanasService.actualizar(Number(req.params.id), req.body);
    res.json({ campana });
  } catch (err) { next(err); }
}

export async function abrir(req, res, next) {
  try {
    const campana = await campanasService.abrir(Number(req.params.id));
    res.json({ campana });
  } catch (err) { next(err); }
}

export async function cerrarIntenciones(req, res, next) {
  try {
    const campana = await campanasService.cerrarIntenciones(Number(req.params.id), req.body);
    res.json({ campana });
  } catch (err) { next(err); }
}

export async function adjudicarDirecta(req, res, next) {
  try {
    const campana = await campanasService.adjudicarDirecta(Number(req.params.id), req.body, req.usuario);
    res.json({ campana });
  } catch (err) { next(err); }
}

export async function generarTanda(req, res, next) {
  try {
    const hija = await campanasService.generarTanda(Number(req.params.id), req.body, req.usuario);
    res.status(201).json({ campana: hija });
  } catch (err) { next(err); }
}

export async function cancelar(req, res, next) {
  try {
    const campana = await campanasService.cancelar(Number(req.params.id), req.body.motivo);
    res.json({ campana });
  } catch (err) { next(err); }
}
