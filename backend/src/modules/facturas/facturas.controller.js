import fs from 'fs';
import * as facturasService from './facturas.service.js';
import { NotFoundError } from '../../utils/errors.js';

export async function generar(req, res, next) {
  try {
    const factura = await facturasService.generarParaOrden(Number(req.params.ordenCompraId));
    res.status(201).json({ factura });
  } catch (err) { next(err); }
}

export async function listarMias(req, res, next) {
  try {
    res.json({ facturas: await facturasService.listarMias(req.usuario.id) });
  } catch (err) { next(err); }
}

export async function listar(req, res, next) {
  try {
    res.json(await facturasService.listar(req.query));
  } catch (err) { next(err); }
}

export async function obtenerPorId(req, res, next) {
  try {
    res.json({ factura: await facturasService.obtenerPorId(Number(req.params.id), req.usuario) });
  } catch (err) { next(err); }
}

export async function descargarPdf(req, res, next) {
  try {
    const factura = await facturasService.obtenerPorId(Number(req.params.id), req.usuario);
    if (!factura.pdfUrl) throw new NotFoundError('PDF de la factura');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="factura-${factura.numero}.pdf"`);
    fs.createReadStream(factura.pdfUrl).pipe(res);
  } catch (err) { next(err); }
}
