import * as usuariosService from './usuarios.service.js';
import { ForbiddenError } from '../../utils/errors.js';

export async function listar(req, res, next) {
  try {
    const resultado = await usuariosService.listar(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const usuario = await usuariosService.obtenerPorId(Number(req.params.id), req.usuario);
    res.json({ usuario });
  } catch (err) { next(err); }
}

export async function actualizar(req, res, next) {
  try {
    const usuario = await usuariosService.actualizar(Number(req.params.id), req.body, req.usuario);
    res.json({ usuario });
  } catch (err) { next(err); }
}

export async function activar(req, res, next) {
  try {
    const usuario = await usuariosService.cambiarEstado(Number(req.params.id), true);
    res.json({ usuario });
  } catch (err) { next(err); }
}

export async function desactivar(req, res, next) {
  try {
    const usuario = await usuariosService.cambiarEstado(Number(req.params.id), false);
    res.json({ usuario });
  } catch (err) { next(err); }
}

export async function cambiarPassword(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (req.usuario.id !== id) throw new ForbiddenError('Solo podés cambiar tu propia contraseña');

    const { passwordActual, passwordNueva } = req.body;
    await usuariosService.cambiarPassword(id, passwordActual, passwordNueva);
    res.status(204).send();
  } catch (err) { next(err); }
}
