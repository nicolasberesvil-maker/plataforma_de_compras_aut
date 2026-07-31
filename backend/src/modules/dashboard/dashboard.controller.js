import ExcelJS from 'exceljs';
import * as dashboardService from './dashboard.service.js';

export async function kpis(req, res, next) {
  try {
    res.json(await dashboardService.obtenerKpis(req.query));
  } catch (err) { next(err); }
}

export async function volumenPorInsumo(req, res, next) {
  try {
    res.json({ volumen: await dashboardService.obtenerVolumenPorInsumo(req.query) });
  } catch (err) { next(err); }
}

export async function rankingProveedores(req, res, next) {
  try {
    res.json({ ranking: await dashboardService.obtenerRankingProveedores(req.query) });
  } catch (err) { next(err); }
}

export async function topProductores(req, res, next) {
  try {
    res.json({ topProductores: await dashboardService.obtenerTopProductores({}) });
  } catch (err) { next(err); }
}

export async function balanceIva(req, res, next) {
  try {
    res.json(await dashboardService.obtenerBalanceIva(req.query));
  } catch (err) { next(err); }
}

export async function formasPago(req, res, next) {
  try {
    res.json({ formasPago: await dashboardService.obtenerFormasPagoFrecuentes() });
  } catch (err) { next(err); }
}

export async function miDashboard(req, res, next) {
  try {
    res.json(await dashboardService.obtenerMiDashboard(req.usuario.id));
  } catch (err) { next(err); }
}

export async function exportarExcel(req, res, next) {
  try {
    const [kpisData, volumen, ranking, topProd] = await Promise.all([
      dashboardService.obtenerKpis(req.query),
      dashboardService.obtenerVolumenPorInsumo(req.query),
      dashboardService.obtenerRankingProveedores(req.query),
      dashboardService.obtenerTopProductores({ limit: 50 })
    ]);

    const workbook = new ExcelJS.Workbook();

    const sheetKpis = workbook.addWorksheet('KPIs');
    sheetKpis.columns = [{ header: 'Indicador', key: 'k', width: 30 }, { header: 'Valor', key: 'v', width: 20 }];
    sheetKpis.addRows([
      { k: 'Ahorro acumulado', v: kpisData.ahorroAcumulado },
      { k: 'Volumen total', v: kpisData.volumenAcumulado },
      { k: 'Monto total', v: kpisData.montoAcumulado },
      { k: 'Campañas activas', v: kpisData.campanas.activas },
      { k: 'Tasa adopción (%)', v: Number(kpisData.tasaAdopcion.porcentaje.toFixed(2)) }
    ]);

    const sheetVol = workbook.addWorksheet('Volumen por insumo');
    sheetVol.columns = [
      { header: 'Producto', key: 'nombre', width: 30 },
      { header: 'Volumen total', key: 'volumenTotal', width: 15 },
      { header: 'Unidad', key: 'unidadMedida', width: 12 },
      { header: 'Monto total', key: 'montoTotal', width: 18 }
    ];
    sheetVol.addRows(volumen);

    const sheetRanking = workbook.addWorksheet('Ranking proveedores');
    sheetRanking.columns = [
      { header: 'Proveedor', key: 'razonSocial', width: 30 },
      { header: 'Campañas ganadas', key: 'campanasGanadas', width: 18 },
      { header: 'Volumen adjudicado', key: 'volumenAdjudicado', width: 20 }
    ];
    sheetRanking.addRows(ranking);

    const sheetTop = workbook.addWorksheet('Top productores');
    sheetTop.columns = [
      { header: 'Productor', key: 'razonSocial', width: 30 },
      { header: 'Total compras', key: 'totalCompras', width: 18 },
      { header: 'Volumen total', key: 'volumenTotal', width: 18 },
      { header: 'Cantidad de órdenes', key: 'cantidadOrdenes', width: 20 }
    ];
    sheetTop.addRows(topProd);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-aut-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
}
