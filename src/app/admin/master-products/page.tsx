"use client";

import React, { useState, useEffect } from 'react';

export default function MasterProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch('/api/master-products');
        const data = await res.json();
        setProducts(data);
      } catch (e: any) {
        setError(e.message || 'Error al cargar productos');
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Cargando productos...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        <h2 className="text-xl font-bold mb-2">Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Productos de la Base Madre</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product: any) => (
          <div key={product.id} className="p-4 border rounded-lg border-gray-200 hover:border-blue-500 transition-colors">
            <div className="text-sm font-medium">{product.sku}</div>
            <div className="text-xs text-gray-500 mt-1">{product.description || '—'}</div>
            <div className="text-right mt-2">
              <div className="font-medium">Costo: ${product.boxCost?.toFixed(2) || '—'}</div>
              <div className="text-xs text-gray-400">caja</div>
            </div>
            <button 
              className="mt-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
              onClick={() => alert('Ver detalles: ' + product.id)}
            >
              Ver
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
