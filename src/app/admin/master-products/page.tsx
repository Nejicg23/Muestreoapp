"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function MasterProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch(`/api/master-products?q=${search}`);
        const data = await res.json();
        setProducts(data.products);
        if (data.success && data.total > 0 && search.length > 0) {
          setSuccess(`Encontrados ${data.total} productos para: "${search}"`);
        } else if (data.success) {
          setSuccess(null);
        }
      } catch (e: any) {
        setError(e.message || 'Error al cargar productos');
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [search]);

  const handleCreate = async (product: any) => {
    try {
      const res = await fetch('/api/master-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
      const result = await res.json();
      if (result.success) {
        setProducts([...products, result.product]);
        setSearch('');
        setSuccess('Producto creado correctamente');
      } else {
        setError(result.error || 'Error al crear producto');
      }
    } catch (e: any) {
      setError(e.message || 'Error de conexión');
    }
  };

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
      
      {/* Barra de búsqueda */}
      <div className="mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código interno o código de barra..."
            className="pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            aria-label="Buscar productos por SKU o código de barras"
          />
        </div>
        {success && (
          <div className="mt-2 p-3 bg-green-600/10 border border-green-500/20 rounded-md text-sm text-green-400">
            {success}
          </div>
        )}
      </div>

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
      
      <div className="mt-6">
        <Link 
          href="/admin/master-products/create" 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          + Crear nuevo producto
        </Link>
      </div>
    </div>
  );
}
