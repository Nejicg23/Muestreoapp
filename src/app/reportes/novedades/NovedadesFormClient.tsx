'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Package2,
  AlertTriangle,
  Search,
  X,
  Truck,
} from 'lucide-react';

type NoveltyType = 'mermade' | 'extra' | 'vencido' | 'dañado' | 'otro';

interface NoveltyItem {
  sku: string;
  desc: string;
  batch: string;
  expiry: string;
  type: NoveltyType;
  notes: string;
  months: number;
}

interface ProductData {
  sku: string;
  description: string;
  barcode: string;
  boxCost: number;
  unitCostCalculated: number;
  packQuantity: number;
  location?: string;
  isActive: boolean;
}

interface FormState {
  novelties: NoveltyItem[];
  newSku: string;
  newDesc: string;
  newBatch: string;
  newExpiry: string;
  newType: NoveltyType;
  newNotes: string;
  product?: ProductData;
}

export default function NovedadesFormClient() {
  const [f, s] = useState<FormState>({
    novelties: [] as NoveltyItem[],
    newSku: '', newDesc: '', newBatch: '', newExpiry: '',
    newType: 'mermade' as NoveltyType, newNotes: '',
    product: undefined,
  });

  // Search by description state
  const [searchResults, setSearchResults] = useState<ProductData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch product data from API when SKU changes
  useEffect(() => {
    if (!f.newSku) {
      s(prev => ({ ...prev, product: undefined }));
      return;
    }
    fetch(`/api/master-products?q=${f.newSku}`)
      .then(async (res) => {
        const data = await res.json();
        if (data.success && data.products && data.products.length > 0) {
          const product = data.products[0] as ProductData;
          s(prev => ({
            ...prev,
            product: {
              sku: product.sku,
              description: product.description,
              barcode: product.barcode,
              boxCost: product.boxCost,
              packQuantity: product.packQuantity,
              unitCostCalculated: product.unitCostCalculated,
              location: product.location,
              isActive: product.isActive,
            },
            newDesc: product.description,
          }));
        } else {
          s(prev => ({ ...prev, product: undefined }));
        }
      })
      .catch((err) => {
        console.error('Error fetching product:', err);
        s(prev => ({ ...prev, product: undefined }));
      });
  }, [f.newSku]);

  // Search products by description
  const handleSearchDescription = async () => {
    const query = f.newDesc.trim();
    if (!query) return;
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/master-products?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success && data.products && data.products.length > 0) {
        setSearchResults(data.products as ProductData[]);
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (err) {
      console.error('Error searching products:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectProduct = (product: ProductData) => {
    s(prev => ({
      ...prev,
      newSku: product.sku,
      newDesc: product.description,
      product: {
        sku: product.sku,
        description: product.description,
        barcode: product.barcode,
        boxCost: product.boxCost,
        packQuantity: product.packQuantity,
        unitCostCalculated: product.unitCostCalculated,
        location: product.location,
        isActive: product.isActive,
      },
    }));
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleAdd = () => {
    const { newSku, newDesc, newBatch, newExpiry, newType, newNotes, product } = f;
    if (!newSku || !newExpiry) return;
    const desc = product?.description || newDesc || 'P-' + newSku;
    const m = 99;
    s({
      novelties: [...f.novelties, { sku: newSku, desc, batch: newBatch || 'N/A', expiry: newExpiry, type: newType, notes: newNotes || '', months: m }],
      newSku: '', newDesc: '', newBatch: '', newExpiry: '',
      newType: 'mermade' as NoveltyType, newNotes: '',
      product: undefined,
    });
  };

  const n = f.novelties.length;
  let v = 0, pv = 0, b = 0;
  if (n > 0) {
    f.novelties.forEach((x) => { 
      if (x.type === 'vencido') v++; 
      else if (x.months <= 3) pv++; 
      else b++; 
    });
  }

  const getTypeColor = (type: NoveltyType) => {
    switch (type) {
      case 'vencido': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'extra': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'mermade': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'dañado': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default: return 'bg-slate-700/50 text-slate-300 border-slate-500/30';
    }
  };

  const getTypeLabel = (type: NoveltyType) => {
    const labels: Record<NoveltyType, string> = {
      mermade: 'Mermade',
      extra: 'Extra',
      vencido: 'Vencido',
      dañado: 'Dañado',
      otro: 'Otro',
    };
    return labels[type];
  };

  // Handle click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
          <h1 className="text-xl font-black text-white">Reporte Novedades</h1>
        </div>
        <p className="text-xs text-slate-500">
          Ingresa productos con novedades (vencimiento, lote, estado). Puedes buscar por SKU o por nombre/descripción.
        </p>

        {/* Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
          {/* SKU Field */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">SKU *</label>
            <input
              type="text"
              value={f.newSku}
              onChange={(e) => s({...f, newSku: e.target.value})}
              placeholder="002520"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>

          {/* Description Field with Search */}
          <div className="relative" ref={searchRef}>
            <label className="block text-xs text-slate-400 mb-1">Descripción</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={f.newDesc}
                onChange={(e) => s({...f, newDesc: e.target.value})}
                placeholder={f.product ? '' : 'Buscar por nombre...'}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={handleSearchDescription}
                disabled={isSearching || !f.newDesc.trim()}
                className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            
            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {searchResults.map((product) => (
                  <button
                    key={product.sku}
                    type="button"
                    onClick={() => selectProduct(product)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0"
                  >
                    <div className="font-mono text-xs text-cyan-400">{product.sku}</div>
                    <div className="text-sm text-white truncate">{product.description}</div>
                    <div className="text-xs text-slate-500">PVP: ${product.boxCost?.toFixed(2) || '0.00'}</div>
                  </button>
                ))}
              </div>
            )}
            
            {showSearchResults && searchResults.length === 0 && f.newDesc.trim() && !isSearching && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50 p-3 text-center text-slate-500 text-sm">
                No se encontraron productos con ese nombre
              </div>
            )}
          </div>

          {/* Lote Field */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Lote *</label>
            <input
              type="text"
              value={f.newBatch}
              onChange={(e) => s({...f, newBatch: e.target.value})}
              placeholder="45dfl"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>

          {/* Expiry Field */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Fecha Vencimiento *</label>
            <input
              type="date"
              value={f.newExpiry}
              onChange={(e) => s({...f, newExpiry: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>

          {/* Type Select */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tipo de Novedad</label>
            <select
              value={f.newType}
              onChange={(e) => s({...f, newType: e.target.value as NoveltyType})}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="mermade">Mermade</option>
              <option value="extra">Extra</option>
              <option value="vencido">Vencido</option>
              <option value="dañado">Dañado</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          {/* Notes Field */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notas / Causal</label>
            <textarea
              value={f.newNotes}
              onChange={(e) => s({...f, newNotes: e.target.value})}
              placeholder="Causal..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </div>

          {/* Add Button */}
          <button
            onClick={handleAdd}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Package2 className="w-4 h-4" />
            Añadir Novedad
          </button>
        </div>

        {/* Items List */}
        {n > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-bold text-amber-400">Detalle de Novedades</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {f.novelties.map((item, index) => (
                <div key={index} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs text-cyan-400">{item.sku}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getTypeColor(item.type)}`}>
                      {getTypeLabel(item.type)}
                    </span>
                  </div>
                  <div className="text-sm text-white truncate mb-1">{item.desc}</div>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>Lote: <span className="text-slate-300">{item.batch}</span></span>
                    <span>Vence: <span className="text-slate-300">{item.expiry}</span></span>
                    {item.notes && <span>Notas: <span className="text-slate-300">{item.notes}</span></span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-4 text-xs">
              <span className="text-amber-400">Total: <strong className="text-white">{n}</strong></span>
              <span className="text-red-400">Vencidos: <strong className="text-white">{v}</strong></span>
              <span className="text-amber-400">Por vencer: <strong className="text-white">{pv}</strong></span>
              <span className="text-green-400">Buenos: <strong className="text-white">{b}</strong></span>
            </div>

            {/* Print Button */}
            <button
              onClick={() => window.print()}
              className="w-full mt-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Truck className="w-4 h-4" />
              Imprimir / Exportar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}