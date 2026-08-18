import { CampanasListPage } from './CampanasListPage';

// Compras ya adjudicadas o cerradas: acá es donde se sabe qué se terminó
// comprando. La confirmación/detalle de cada orden vive en el detalle de la
// campaña (tab "Órdenes de compra").
export function OrdenesCompraAdminPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Órdenes de compra</h2>
        <p className="text-sm text-gray-500">Compras ya adjudicadas: enviale la orden de compra al proveedor ganador para confirmarle qué se compró.</p>
      </div>
      <CampanasListPage vista="ordenes" />
    </div>
  );
}
