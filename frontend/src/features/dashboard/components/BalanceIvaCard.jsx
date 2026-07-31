export function BalanceIvaCard({ data }) {
  if (!data) return null;
  const positivo = data.saldo >= 0;

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Balance IVA</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-500">IVA débito</p>
          <p className="font-semibold">${data.ivaDebito.toLocaleString('es-AR')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">IVA crédito (estimado)</p>
          <p className="font-semibold">${data.ivaCredito.toLocaleString('es-AR')}</p>
        </div>
      </div>
      <p className={`mt-3 text-sm font-medium ${positivo ? 'text-aut-verde' : 'text-aut-naranja'}`}>
        Saldo: ${data.saldo.toLocaleString('es-AR')}
      </p>
      <p className="mt-2 text-xs text-gray-400">{data.nota}</p>
    </div>
  );
}
