import * as stockService from './stock.service.js';

export async function registrarIngreso(req, res, next) {
  try {
    const movimiento = await stockService.registrarIngreso(req.body, req.usuario.id);
    res.status(201).json({ movimiento });
  } catch (err) { next(err); }
}

export async function registrarEgresoManual(req, res, next) {
  try {
    const movimiento = await stockService.registrarEgresoManual(req.body, req.usuario.id);
    res.status(201).json({ movimiento });
  } catch (err) { next(err); }
}

export async function registrarAjuste(req, res, next) {
  try {
    const movimiento = await stockService.registrarAjuste(req.body, req.usuario.id);
    res.status(201).json({ movimiento });
  } catch (err) { next(err); }
}

export async function registrarTransferencia(req, res, next) {
  try {
    const resultado = await stockService.registrarTransferencia(req.body, req.usuario.id);
    res.status(201).json(resultado);
  } catch (err) { next(err); }
}

export async function listarMovimientos(req, res, next) {
  try {
    const resultado = await stockService.listarMovimientos(req.query);
    res.json(resultado);
  } catch (err) { next(err); }
}
