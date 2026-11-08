import MasterProduct from '@/types/master-product';

interface MasterProductCardProps {
  product: MasterProduct;
}

export function MasterProductCard({ product }: MasterProductCardProps) {
  return (
    <div className="p-4 border rounded-lg border-gray-200 hover:border-blue-500 transition-colors">
      <div className="text-sm font-medium">{product.sku}</div>
      <div className="text-xs text-gray-500 mt-1">{product.description || '—'}</div>
      <div className="text-right mt-2">
        <div className="font-medium">Costo: ${product.boxCost?.toFixed(2) || '—'}</div>
        <div className="text-xs text-gray-400">caja</div>
      </div>
      <button 
        className="mt-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
        onClick={() => console.log('Ver detalles:', product.id)}
      >
        Ver
      </button>
    </div>
  );
}
