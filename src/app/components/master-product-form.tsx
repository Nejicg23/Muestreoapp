import { MasterProduct } from '@/types/master-product';
import { useState } from 'react';

export interface MasterProductFormProps {
  onSuccess?: (product: MasterProduct) => void;
}

export function MasterProductForm({ onSuccess }: MasterProductFormProps) {
  const [formData, setFormData] = useState({
    sku: '',
    description: '',
    barcode: '',
    boxCost: 0,
    packQuantity: 1,
    unitCostCalculated: undefined as number | undefined,
    location: '',
    isActive: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validación simple
    if (!formData.sku.trim()) {
      setErrors(prev => ({ ...prev, sku: 'SKU requerido' }));
      return;
    }
    if (!formData.description.trim()) {
      setErrors(prev => ({ ...prev, description: 'Descripción requerida' }));
      return;
    }
    if (formData.boxCost <= 0) {
      setErrors(prev => ({ ...prev, boxCost: 'Costo debe ser mayor a 0' }));
      return;
    }

    try {
      const product = await createMasterProduct(formData);
      onSuccess?.(product);
    } catch (err: any) {
      alert('Error al crear producto: ' + (err.message || 'Error desconocido'));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">SKU</label>
        <input
          value={formData.sku}
          onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
          className={`w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.sku ? 'border-red-500' : ''}`}
          disabled={false}
          required
          placeholder="Ej: PROD-001"
        />
        {errors.sku && <p className="text-xs text-red-600 mt-1">{errors.sku}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Descripción</label>
        <input
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className={`w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.description ? 'border-red-500' : ''}`}
          disabled={false}
          required
          placeholder="Nombre del producto"
        />
        {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Costo por Caja</label>
          <input
            type="number"
            value={formData.boxCost}
            onChange={(e) => setFormData(prev => ({ ...prev, boxCost: parseFloat(e.target.value) || 0 }))}
            className={`w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.boxCost ? 'border-red-500' : ''}`}
            disabled={false}
            required
            min="0"
            step="0.01"
            placeholder="0.00"
          />
          {errors.boxCost && <p className="text-xs text-red-600 mt-1">{errors.boxCost}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Cantidad por Paquete</label>
          <input
            type="number"
            value={formData.packQuantity}
            onChange={(e) => setFormData(prev => ({ ...prev, packQuantity: parseInt(e.target.value) || 1 }))}
            className={`w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500`}
            disabled={false}
            required
            min="1"
            step="1"
            placeholder="1"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Costo Unitario Calculado</label>
        <input
          type="number"
          value={formData.unitCostCalculated !== undefined ? String(formData.unitCostCalculated) : ''}
          onChange={(e) => setFormData(prev => ({ ...prev, unitCostCalculated: parseFloat(e.target.value) || undefined }))}
          className={`w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500`}
          disabled={false}
          step="0.01"
          placeholder="Opcional"
        />
        <p className="text-xs text-gray-500 mt-1">Dejar vacío para calcular automáticamente</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Ubicación</label>
        <input
          value={formData.location}
          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
          className={`w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500`}
          disabled={false}
          placeholder="Almacén/Bodega"
        />
      </div>

      <div className="flex items-center justify-between">
        <label>
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            className="rounded border-gray-300 focus:ring-blue-500"
          />
          {formData.isActive ? 'Activo' : 'Inactivo'}
        </label>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={Object.keys(errors).length > 0}
        >
          Guardar Producto
        </button>
      </div>
    </form>
  );
}
