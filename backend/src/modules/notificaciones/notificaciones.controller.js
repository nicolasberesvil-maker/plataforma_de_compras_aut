import * as notificacionesService from './notificaciones.service.js';

export async function listar(req, res, next) {
  try {
    const { soloNoLeidas, page, limit } = req.query;
    const resultado = await notificacionesService.listarPorUsuario(req.usuario.id, {
      soloNoLeidas: soloNoLeidas === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined
    });
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function contarNoLeidas(req, res, next) {
  try {
    const count = await notificacionesService.contarNoLeidas(req.usuario.id);
    res.json({ count });
  } catch (err) { next(err); }
}

export async function marcarComoLeida(req, res, next) {
  try {
    const notificacion = await notificacionesService.marcarComoLeida(Number(req.params.id), req.usuario.id);
    res.json({ notificacion });
  } catch (err) { next(err); }
}
