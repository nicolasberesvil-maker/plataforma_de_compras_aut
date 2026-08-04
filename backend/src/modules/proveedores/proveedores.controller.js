import { prisma } from '../../config/database.js';
import { ForbiddenError } from '../../utils/errors.js';
import * as proveedoresService from './proveedores.service.js';
import { obtenerCuentaCorriente, registrarPago } from './proveedores.cuenta-corriente.js';

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
    const { usuario, proveedor } = await proveedoresService.crear(req.body);
    res.status(201).json({
      proveedor,
      usuario: { id: usuario.id, username: usuario.username, email: usuario.email }
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

export async function cuentaCorriente(req, res, next) {
  try {
    const id = Number(req.params.id);
    await proveedoresService.obtenerPorId(id, req.usuario);
    const cuentaCorriente = await obtenerCuentaCorriente(id);
    res.json(cuentaCorriente);
  } catch (err) { next(err); }
}

/** "Mi cuenta" del portal proveedor: cuenta corriente propia (solo lectura). */
export async function miCuenta(req, res, next) {
  try {
    const proveedor = await prisma.proveedor.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!proveedor) throw new ForbiddenError('Usuario no es proveedor');

    const cuentaCorriente = await obtenerCuentaCorriente(proveedor.id);
    res.json(cuentaCorriente);
  } catch (err) { next(err); }
}

export async function crearPago(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pago = await registrarPago(id, req.body, req.usuario.id);
    res.status(201).json({ pago });
  } catch (err) { next(err); }
}
