import * as cotizacionesService from './cotizaciones.service.js';

export async function listarMias(req, res, next) {
  try {
    const cotizaciones = await cotizacionesService.listarMias(req.usuario.id);
    res.json({ cotizaciones });
  } catch (err) { next(err); }
}

export async function listarCampanasParaCotizar(req, res, next) {
  try {
    const campanas = await cotizacionesService.listarCampanasParaCotizar(req.usuario.id);
    res.json({ campanas });
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const cotizacion = await cotizacionesService.obtenerPorId(Number(req.params.id), req.usuario);
    res.json({ cotizacion });
  } catch (err) { next(err); }
}

export async function crear(req, res, next) {
  try {
    const cotizacion = await cotizacionesService.crear(req.body, req.usuario.id);
    res.status(201).json({ cotizacion });
  } catch (err) { next(err); }
}

export async function crearLote(req, res, next) {
  try {
    const resultado = await cotizacionesService.crearLote(req.body, req.usuario.id);
    res.status(200).json(resultado); // { creadas, errores } — batch, no una única creación
  } catch (err) { next(err); }
}

export async function actualizar(req, res, next) {
  try {
    const cotizacion = await cotizacionesService.actualizar(Number(req.params.id), req.body, req.usuario.id);
    res.json({ cotizacion });
  } catch (err) { next(err); }
}

export async function eliminar(req, res, next) {
  try {
    await cotizacionesService.eliminar(Number(req.params.id), req.usuario.id);
    res.status(204).send();
  } catch (err) { next(err); }
}
