import { useState } from 'react';
import { facturasApi } from '../api/facturas.api';

// El PDF va detrás de auth (Bearer token), así que no puede ser un <a href>
// directo: se pide como blob y se dispara la descarga desde JS.
export function BotonDescargarPdf({ factura, className }) {
  const [descargando, setDescargando] = useState(false);

  async function descargar() {
    setDescargando(true);
    try {
      const blob = await facturasApi.descargarPdf(factura.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${factura.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargando(false);
    }
  }

  return (
    <button
      onClick={descargar}
      disabled={descargando}
      className={className ?? 'text-sm text-aut-verde font-medium disabled:opacity-50'}
    >
      {descargando ? 'Descargando...' : 'Descargar PDF'}
    </button>
  );
}
