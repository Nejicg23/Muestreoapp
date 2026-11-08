"use client";

import { useState } from 'react';
import { MasterProduct } from '@/types/master-product';

export default function MasterProductCreatePage() {
  const [formData, setFormData] = useState({
    sku: '',
    description: '',
    barcode: '',
    boxCost: 0,
    packQuantity: 1,
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      if (!formData.sku.trim()) throw new Error('SKU requerido');
      if (!formData.description.trim()) throw new Error('Descripción requerida');
      if (formData.boxCost <= 0) throw new Error('Costo debe ser > 0');

      const res = await fetch('/api/master-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: formData.sku,
          description: formData.description,
          barcode: formData.barcode || undefined,
          boxCost: formData.boxCost,
          packQuantity: formData.packQuantity,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error del servidor');
      alert('Producto creado: ' + data.product.sku);
    } catch (e: any) {
      setError(e.message || 'Error desconocido');
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <form onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">SKU</label>
            <input
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: PROD-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Descripción</label>
            <input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del producto"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Costo por Caja</label>
            <input
              type="number"
              value={formData.boxCost}
              onChange={(e) => setFormData({ ...formData, boxCost: parseFloat(e.target.value) || 0 })}
              min="0"
              step="0.01"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Cantidad por Paquete</label>
            <input
              type="number"
              value={formData.packQuantity}
              onChange={(e) => setFormData({ ...formData, packQuantity: parseInt(e.target.value) || 1 })}
              min="1"
              step="1"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mt-4"
        >
          Guardar Producto
        </button>
      </form>
    </div>
  );
}
