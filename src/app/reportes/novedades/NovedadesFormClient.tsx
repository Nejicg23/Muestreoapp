'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package2,
  AlertTriangle,
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

  function add() {
    const { newSku, newDesc, newBatch, newExpiry, newType, newNotes, product } = f;
    if (!newSku || !newExpiry) return;
    // Use product description if available, otherwise use entered description
    const desc = product?.description || newDesc || 'P-' + newSku;
    const m = 99; // dummy value
    s({
      novelties: [...f.novelties, { sku: newSku, desc, batch: newBatch || 'N/A', expiry: newExpiry, type: newType, notes: newNotes || '', months: m }],
      newSku: '', newDesc: '', newBatch: '', newExpiry: '',
      newType: 'mermade' as NoveltyType, newNotes: '',
      product: undefined,
    });
  }

  const n = f.novelties.length;
  let v = 0, pv = 0, b = 0;
  if (n > 0) {
    f.novelties.forEach(function (x: any) { if (x.type === 'vencido') v++; else if (x.months <= 3) pv++; else b++; });
  }

  let rows = '';
  if (n > 0) {
    f.novelties.forEach(function (x: any) {
      rows += '<div style="border-bottom:1px solid #555;padding:6px 0;font-size:9px;color:#d0d0d0;"><span style="flex:1;">' + x.sku + '</span><span>' + (x.desc || '').substring(0,8) + '</span><span>' + x.batch + '</span><span>' + x.expiry + '</span><span style="color:' + (x.type === 'vencido' ? '#f00' : '#ffb400') + ';">' + x.type + '</span></div>';
    });
  }

  let summary = '';
  if (n > 0) {
    summary = '<div style="marginTop:8px;fontSize:9px;color:#a0a0a0;"><span style="color:#ffb400;">Total:</span> ' + n + ' &nbsp;|&nbsp; <span style="color:#f00;">Vencidos:</span> ' + v + ' &nbsp;|&nbsp; <span style="color:#ffb400;">Por vencer:</span> ' + pv + ' &nbsp;|&nbsp; <span style="color:#00a851;">Buenos:</span> ' + b + '</div>';
  }

  let printBtn = '';
  if (n > 0) {
    printBtn = '<button style="width:100%;background:#0099ff;color:#fff;border:none;padding:6px;borderRadius:4px;fontSize:9px;fontWeight:bold;" onclick={()=>window.print()}><Truck style="width:12px;height:12px;marginRight:4px" /> Imprimir</button>';
  }

  const mc: any = 99; // dummy months count for template

  // Build the description input with pre-filled value from product DB
  const descValue = f.product?.description || f.newDesc;
  const descPlaceholder = f.product ? '' : 'Descripción';

  const body: string = '<div style="minHeight:100vh;background:#0d0d0d;color:#e0e0e0;padding:20px;fontFamily:sans-serif;">' +
    '<h1 style="color:#ffb400;fontSize:16px;marginBottom:12px;"><AlertTriangle style="width:14px;height:14px;marginRight:6px;verticalAlign:middle" /> Reporte Novedades</h1>' +
    '<p style="color:#707070;fontSize:9px;marginBottom:20px;">Ingresa productos con novedades (vencimiento,lote,estado). Puedes agregar varios items con diferentes lotes. ' +
    '<span style="color:#ffb400;fontSize:9px;fontWeight:bold;">Cuando ingreses un SKU, la descripción se cargará automáticamente de la base de datos.</span>' +
    '</p>' +
    '<div style="background:#1a1a1a;border:1px solid #333;borderRadius:4px;padding:16px;marginBottom:20px;">' +
    '<div style="display:grid;gridTemplateColumns:1fr 1fr;gap:12px;marginBottom:12px;">' +
    '<div><label style="color:#a0a0a0;fontSize:9px;marginBottom:4px;display:block;">SKU *</label><input style="width:100%;background:#0a0a0a;border:1px solid #2a2a2a;borderRadius:4px;padding:6px;color:#e0e0e0;fontSize:9px;" type="text" value="' + f.newSku + '" onChange="(e)=>s({novelties:f.novelties,newSku:e.target.value,newDesc:f.newDesc,newBatch:f.newBatch,newExpiry:f.newExpiry,newType:f.newType,newNotes:f.newNotes})" required placeholder="002520" /></div>' +
    '<div><label style="color:#a0a0a0;fontSize:9px;marginBottom:4px;display:block;">Descripción</label>' +
    '<input style="width:100%;background:#0a0a0a;border:1px solid #2a2a2a;borderRadius:4px;padding:6px;color:#e0e0e0;fontSize:9px;" type="text" value="' + descValue + '" onChange="(e)=>s({novelties:f.novelties,newSku:f.newSku,newDesc:e.target.value,newBatch:f.newBatch,newExpiry:f.newExpiry,newType:f.newType,newNotes:f.newNotes})" placeholder="' + descPlaceholder + '" /></div>' +
    '<div><label style="color:#a0a0a0;fontSize:9px;marginBottom:4px;display:block;">Lote *</label><input style="width:100%;background:#0a0a0a;border:1px solid #2a2a2a;borderRadius:4px;padding:6px;color:#e0e0e0;fontSize:9px;" type="text" value="' + f.newBatch + '" onChange="(e)=>s({novelties:f.novelties,newSku:f.newSku,newDesc:e.target.value,newBatch:f.newBatch,newExpiry:f.newExpiry,newType:f.newType,newNotes:f.newNotes})" placeholder="45dfl" required /></div>' +
    '<div><label style="color:#a0a0a0;fontSize:9px;marginBottom:4px;display:block;">Vence *</label><input style="width:100%;background:#0a0a0a;border:1px solid #2a2a2a;borderRadius:4px;padding:6px;color:#e0e0e0;fontSize:9px;" type="date" value="' + f.newExpiry + '" onChange="(e)=>s({novelties:f.novelties,newSku:f.newSku,newDesc:f.newDesc,newBatch:f.newBatch,newExpiry:e.target.value,newType:f.newType,newNotes:f.newNotes})" /></div>' +
    '<div><label style="color:#a0a0a0;fontSize:9px;marginBottom:4px;display:block;">Tipo</label><select style="width:100%;background:#0a0a0a;border:1px solid #2a2a2a;borderRadius:4px;padding:6px;color:#e0e0e0;fontSize:9px;" value="' + f.newType + '" onChange="(e)=>s({novelties:f.novelties,newSku:f.newSku,newDesc:f.newDesc,newBatch:f.newBatch,newExpiry:f.newExpiry,newType:(e.target.value: NoveltyType),newNotes:f.newNotes})">' +
    '<option value="mermade">Mermade</option><option value="extra">Extra</option><option value="vencido">Vencido</option><option value="dañado">Dañado</option><option value="otro">Otro</option>' +
    '</select></div>' +
    '</div>' +
    '<div style="marginTop:8px;"><label style="color:#a0a0a0;fontSize:9px;marginBottom:4px;">Meses</label><span style="color:#e0e0e0;fontSize:9px;">' + mc + '</span></div>' +
    '<div style="marginTop:8px;"><label style="color:#a0a0a0;fontSize:9px;marginBottom:4px;">Notas</label><textarea style="width:100%;background:#0a0a0a;border:1px solid #2a2a2a;borderRadius:4px;padding:6px;color:#e0e0e0;fontSize:9px;resize:vertical;marginBottom:6px;minHeight:40px;" rows="3" value="' + f.newNotes + '" onChange="(e)=>s({novelties:f.novelties,newSku:f.newSku,newDesc:f.newDesc,newBatch:f.newBatch,newExpiry:f.newExpiry,newType:f.newType,newNotes:e.target.value})" placeholder="Causal..."></textarea></div>' +
    '</div>' +
    '<div style="marginTop:16px;"><button onClick="add()" style="width:100%;background:#e6a700;color:#000;border:none;padding:6px;borderRadius:4px;fontSize:9px;fontWeight:bold;"><Package2 style="width:12px;height:12px;marginRight:4px" /> Añadir</button></div>' +
    (n > 0 ? '<div style="marginTop:24px;"><div style="color:#ffb400;fontSize:12px;marginBottom:8px;">Detalle de Novedades</div>' + rows + '<div style="marginTop:8px;fontSize:9px;color:#a0a0a0;">' + summary + '</div></div>' : '') +
    (printBtn ? printBtn : '') +
    '</div>';

  return <div dangerouslySetInnerHTML={{ __html: body }} />;
}