import * as proveedoresService from './proveedores.service.js';

export async function listar(req, res, next) {
  try {
    const resultado = await proveedoresService.listar(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    const proveedor = await proveedoresService.obtenerPorId(Number(req.params.id), req.usuario);
    res.json({ proveedor });
  } catch (err) { next(err); }
}

export async function crear(req, res, next) {
  try {
    const { usuario, proveedor, passwordTemporal } = await proveedoresService.crear(req.body);
    res.status(201).json({
      proveedor,
      usuario: { id: usuario.id, email: usuario.email },
      passwordTemporal
    });
  } catch (err) { next(err); }
}

export async function actualizar(req, res, next) {
  try {
    const proveedor = await proveedoresService.actualizar(Number(req.params.id), req.body);
    res.json({ proveedor });
  } catch (err) { next(err); }
}

export async function aprobar(req, res, next) {
  try {
    const proveedor = await proveedoresService.aprobar(Number(req.params.id));
    res.json({ proveedor });
  } catch (err) { next(err); }
}

export async function suspender(req, res, next) {
  try {
    const proveedor = await proveedoresService.suspender(Number(req.params.id));
    res.json({ proveedor });
  } catch (err) { next(err); }
}
