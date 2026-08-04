import * as intencionesService from './intenciones.service.js';

export async function listarMias(req, res, next) {
  try {
    const intenciones = await intencionesService.listarMias(req.usuario.id);
    res.json({ intenciones });
  } catch (err) { next(err); }
}

export async function listar(req, res, next) {
  try {
    const resultado = await intencionesService.listar(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const intencion = await intencionesService.obtenerPorId(Number(req.params.id), req.usuario);
    res.json({ intencion });
  } catch (err) { next(err); }
}

export async function crear(req, res, next) {
  try {
    const intencion = await intencionesService.crear(req.body, req.usuario.id);
    res.status(201).json({ intencion });
  } catch (err) { next(err); }
}

export async function actualizar(req, res, next) {
  try {
    const intencion = await intencionesService.actualizar(Number(req.params.id), req.body, req.usuario.id);
    res.json({ intencion });
  } catch (err) { next(err); }
}

export async function eliminar(req, res, next) {
  try {
    await intencionesService.eliminar(Number(req.params.id), req.usuario.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function descartar(req, res, next) {
  try {
    const intencion = await intencionesService.descartar(Number(req.params.id), req.body.motivo);
    res.json({ intencion });
  } catch (err) { next(err); }
}

export async function agrupar(req, res, next) {
  try {
    const campana = await intencionesService.agrupar(req.body, req.usuario);
    res.status(201).json({ campana });
  } catch (err) { next(err); }
}

export async function tablero(req, res, next) {
  try {
    const data = await intencionesService.obtenerTablero();
    res.json({ data });
  } catch (err) { next(err); }
}
