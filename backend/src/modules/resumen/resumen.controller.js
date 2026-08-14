import * as resumenService from './resumen.service.js';

export async function pedidos(req, res, next) {
  try {
    const resultado = await resumenService.obtenerResumenPedidos(req.query, req.usuario);
    res.json(resultado);
  } catch (err) { next(err); }
}
