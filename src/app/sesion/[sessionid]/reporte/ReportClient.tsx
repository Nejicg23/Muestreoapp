'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Barcode,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Layers,
  Search,
  Lock,
  ShieldCheck,
  Filter,
  Download,
  AlertOctagon,
  Calendar,
  User,
  Clock,
  Printer,
  FileSpreadsheet,
  HelpCircle,
  Hash,
  ChevronDown,
  Check,
  X,
  ShieldAlert,
  Sparkles,
  Tag,
  Shield,
  FileText,
  Camera,
  Image as ImageIcon,
  Eye,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ConsolidatedItem,
  InventorySummary,
  formatStockBreakdown,
} from '@/lib/inventory-consolidator';
import { closeInventorySession } from '@/app/actions/sync';
import { updateItemImage } from '@/app/conteo/[sessionid]/actions';
import { compressAndConvertToBase64 } from '@/lib/image-helper';

interface Props {
  session: {
    id: string;
    title: string;
    status: string;
    createdBy: string;
    createdAt: Date | string;
    closedAt?: Date | string | null;
    closedHash?: string | null;
  };
  consolidated: ConsolidatedItem[];
  summary: InventorySummary;
  novelties: Array<{
    id: string;
    itemId: string | null;
    noveltyType: string;
    quantity: string | number;
    batchNumber: string | null;
    expirationDate: Date | string | null;
    notes: string | null;
    reportedBy: string;
    createdAt: Date | string;
    imageUrl?: string | null;
  }>;
}

export default function ReportClient({
  session: initialSession,
  consolidated,
  summary,
  novelties,
}: Props) {
  const [session, setSession] = useState(initialSession);
  const [itemsList, setItemsList] = useState<ConsolidatedItem[]>(consolidated);
  const [reportView, setReportView] = useState<'detailed' | 'quick_a6' | 'quarantine'>('detailed');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quarantineFilter, setQuarantineFilter] = useState<'all' | 'quarantine' | 'expired' | 'valid'>('all');
  const [isClosing, setIsClosing] = useState(false);
  const [closeSuccessMsg, setCloseSuccessMsg] = useState<string | null>(null);

  // Modales de Imágenes y Etiquetas
  const [activeLabelItem, setActiveLabelItem] = useState<ConsolidatedItem | null>(null);
  const [viewImageModal, setViewImageModal] = useState<{ url: string; title: string } | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  // Subir / Tomar foto desde Celular o PC
  const handleUploadItemImage = async (itemId: string, file: File) => {
    try {
      setUploadingItemId(itemId);
      const base64 = await compressAndConvertToBase64(file);
      const res = await updateItemImage(itemId, base64);
      if (res.success) {
        setItemsList((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, imageUrl: base64 } : i))
        );
        if (activeLabelItem && activeLabelItem.id === itemId) {
          setActiveLabelItem((prev) => (prev ? { ...prev, imageUrl: base64 } : null));
        }
      } else {
        alert('Error al guardar imagen: ' + (res.error || 'Desconocido'));
      }
    } catch (err: any) {
      alert('Error al procesar la imagen: ' + err.message);
    } finally {
      setUploadingItemId(null);
    }
  };

  // Conteo de discrepancias y novedades para insignias
  const noveltiesOrDiffCount = itemsList.filter(
    (i) => i.status === 'surplus' || i.status === 'shortage' || i.requiresRecount || i.hasNovelties
  ).length;

  const surplusCount = itemsList.filter((i) => i.status === 'surplus').length;
  const shortageCount = itemsList.filter((i) => i.status === 'shortage').length;
  const uncountedCount = itemsList.filter((i) => i.status === 'uncounted').length;
  const matchedCount = itemsList.filter((i) => i.status === 'matched').length;

  // Listados específicos para los Tickets A6
  const shortageItems = useMemo(
    () => itemsList.filter((i) => i.status === 'shortage' || i.difference < 0),
    [itemsList]
  );
  const surplusItems = useMemo(
    () => itemsList.filter((i) => i.status === 'surplus' || i.difference > 0),
    [itemsList]
  );

  // Productos con Fecha de Vencimiento y Análisis de Cuarentena (< 3 meses)
  const expiringProducts = useMemo(() => {
    const list: Array<{
      id: string;
      sku: string;
      description: string;
      batchNumber: string | null;
      expirationDate: Date;
      daysDiff: number;
      status: 'expired' | 'quarantine' | 'valid';
      location: string | null;
      stock: number;
      packQuantity: number;
      imageUrl?: string | null;
    }> = [];

    // Ítems de consolidado
    for (const item of itemsList) {
      if (item.expirationDate) {
        const d = new Date(item.expirationDate);
        if (!isNaN(d.getTime())) {
          const daysDiff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          list.push({
            id: item.id,
            sku: item.sku,
            description: item.description,
            batchNumber: item.batchNumber || null,
            expirationDate: d,
            daysDiff,
            status: daysDiff <= 0 ? 'expired' : daysDiff <= 90 ? 'quarantine' : 'valid',
            location: item.location,
            stock: item.totalCounted > 0 ? item.totalCounted : item.systemStock,
            packQuantity: item.packQuantity,
            imageUrl: item.imageUrl,
          });
        }
      }
    }

    // Novedades con fecha de vencimiento
    for (const nov of novelties) {
      if (nov.expirationDate) {
        const d = new Date(nov.expirationDate);
        if (!isNaN(d.getTime())) {
          const existing = list.find((x) => x.id === nov.itemId);
          if (!existing) {
            const matchingItem = itemsList.find((x) => x.id === nov.itemId);
            const daysDiff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            list.push({
              id: nov.id,
              sku: matchingItem?.sku || 'N/A',
              description: matchingItem?.description || (nov.notes ? `Novedad: ${nov.notes}` : 'Producto con Novedad'),
              batchNumber: nov.batchNumber || null,
              expirationDate: d,
              daysDiff,
              status: daysDiff <= 0 ? 'expired' : daysDiff <= 90 ? 'quarantine' : 'valid',
              location: matchingItem?.location || null,
              stock: Number(nov.quantity) || 0,
              packQuantity: matchingItem?.packQuantity || 1,
              imageUrl: nov.imageUrl || matchingItem?.imageUrl,
            });
          }
        }
      }
    }

    // Ordenar: primero los más próximos a vencer o vencidos
    return list.sort((a, b) => a.daysDiff - b.daysDiff);
  }, [itemsList, novelties]);

  const quarantineCount = expiringProducts.filter((p) => p.status === 'quarantine').length;
  const expiredCount = expiringProducts.filter((p) => p.status === 'expired').length;
  const validCount = expiringProducts.filter((p) => p.status === 'valid').length;

  const filteredExpiringProducts = useMemo(() => {
    return expiringProducts.filter((p) => {
      const matchesSearch =
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.batchNumber && p.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;
      if (quarantineFilter === 'all') return true;
      return p.status === quarantineFilter;
    });
  }, [expiringProducts, searchQuery, quarantineFilter]);

  // Filtrado de items consolidados para vista detallada
  const filteredItems = itemsList.filter((item) => {
    const matchesSearch =
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.barcode && item.barcode.includes(searchQuery)) ||
      (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterStatus === 'all') return true;
    if (filterStatus === 'novelties_only') {
      return (
        item.status === 'surplus' ||
        item.status === 'shortage' ||
        item.requiresRecount ||
        item.hasNovelties
      );
    }
    if (filterStatus === 'discrepancy') return item.status === 'surplus' || item.status === 'shortage';
    if (filterStatus === 'surplus') return item.status === 'surplus';
    if (filterStatus === 'shortage') return item.status === 'shortage';
    if (filterStatus === 'matched') return item.status === 'matched';
    if (filterStatus === 'uncounted') return item.status === 'uncounted';
    if (filterStatus === 'recount') return item.requiresRecount;

    return true;
  });

  // Cerrar y sellar sesión de inventario con SHA-256
  const handleCloseSession = async () => {
    const confirmClose = window.confirm(
      '¿Estás seguro de cerrar definitivamente esta sesión de inventario? Se generará un hash criptográfico SHA-256 para auditoría y no se admitirán más conteos.'
    );
    if (!confirmClose) return;

    setIsClosing(true);
    const res = await closeInventorySession(session.id, session.createdBy || 'Auditor');
    if (res.success && res.data) {
      setSession(res.data as any);
      setCloseSuccessMsg('Sesión sellada y certificada exitosamente.');
    }
    setIsClosing(false);
  };

  // EXPORTAR A EXCEL: COMPLETO
  const handleExportExcelFull = () => {
    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen Ejecutivo
    const summaryData = [
      { Parámetro: 'Título de la Sesión', Valor: session.title },
      { Parámetro: 'Auditor Responsable', Valor: session.createdBy },
      { Parámetro: 'Fecha de Apertura', Valor: new Date(session.createdAt).toLocaleString('es-ES') },
      { Parámetro: 'Estado de la Sesión', Valor: session.status === 'closed' ? 'Cerrada / Sellada' : 'En Progreso' },
      { Parámetro: 'Sello SHA-256', Valor: session.closedHash || 'Pendiente de Cierre' },
      { Parámetro: 'Total Ítems en Catálogo', Valor: summary.totalItems },
      { Parámetro: 'Ítems Contados', Valor: summary.countedItems },
      { Parámetro: 'Ítems No Contados', Valor: summary.uncountedItems },
      { Parámetro: 'Ítems Coincidentes (100% Exactos)', Valor: summary.matchedItems },
      { Parámetro: 'Ítems con Discrepancias', Valor: summary.discrepantItems },
      { Parámetro: 'Ítems que Requieren Reconteo', Valor: summary.requiresRecountCount },
      { Parámetro: 'Total Novedades Físicas', Valor: summary.noveltiesTotal },
      { Parámetro: 'Ganancia por Sobrantes ($)', Valor: summary.totalSurplusCost },
      { Parámetro: 'Pérdida por Faltantes ($)', Valor: summary.totalShortageCost },
      { Parámetro: 'Impacto Financiero Neto ($)', Valor: summary.netCostImpact },
      { Parámetro: 'Exactitud Global (%)', Valor: `${summary.progressPercentage}%` },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Ejecutivo');

    // Hoja 2: Inventario Detallado
    const detailedData = itemsList.map((item) => {
      const theo = formatStockBreakdown(item.systemStock, item.packQuantity);
      const counted = formatStockBreakdown(item.totalCounted, item.packQuantity);
      const diffBreakdown = formatStockBreakdown(Math.abs(item.difference), item.packQuantity);

      return {
        'SKU': item.sku,
        'Código de Barras': item.barcode || '',
        'Descripción del Producto': item.description,
        'Ubicación': item.location || '',
        'Factor (1xN)': `1x${item.packQuantity}`,
        'Stock Teórico (Fracc)': item.systemStock,
        'Stock Teórico (Desglose)': theo.formatted,
        'Físico Contado (Fracc)': item.status === 'uncounted' ? 0 : item.totalCounted,
        'Físico Contado (Desglose)': item.status === 'uncounted' ? 'No contado' : counted.formatted,
        'Diferencia (Fracc)': item.difference,
        'Diferencia (Desglose)':
          item.difference === 0
            ? '0 u'
            : `${item.difference > 0 ? '+' : '-'}${diffBreakdown.formatted}`,
        '% Variación': `${item.differencePercentage}%`,
        'Costo Fracción ($)': item.unitCostCalculated,
        'Impacto Financiero ($)': item.costImpact,
        'Estado':
          item.status === 'matched'
            ? 'Coincidente'
            : item.status === 'surplus'
            ? 'Sobrante'
            : item.status === 'shortage'
            ? 'Faltante'
            : 'No Contado',
        'Requiere Reconteo': item.requiresRecount ? 'SÍ' : 'NO',
        'Novedades Reportadas': item.noveltiesCount > 0 ? `SÍ (${item.noveltiesCount})` : 'NO',
        'Lote': item.batchNumber || '',
        'Fecha Vencimiento': item.expirationDate
          ? new Date(item.expirationDate).toLocaleDateString('es-ES')
          : '',
        'Tiene Foto': item.imageUrl ? 'SÍ' : 'NO',
      };
    });
    const wsDetailed = XLSX.utils.json_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(wb, wsDetailed, 'Inventario Detallado');

    // Hoja 3: Productos por Vencer / Cuarentena
    if (expiringProducts.length > 0) {
      const quarantineData = expiringProducts.map((p) => ({
        'SKU': p.sku,
        'Descripción': p.description,
        'Lote': p.batchNumber || 'N/A',
        'Fecha Vencimiento': p.expirationDate.toLocaleDateString('es-ES'),
        'Días Restantes': p.daysDiff,
        'Estado':
          p.status === 'expired'
            ? 'VENCIDO'
            : p.status === 'quarantine'
            ? 'PRÓXIMO A VENCER (< 3 MESES) - CUSTODIA/CUARENTENA'
            : 'VIGENTE',
        'Stock': p.stock,
        'Ubicación': p.location || '',
      }));
      const wsQuarantine = XLSX.utils.json_to_sheet(quarantineData);
      XLSX.utils.book_append_sheet(wb, wsQuarantine, 'Cuarentena y Vencimientos');
    }

    // Hoja 4: Novedades Físicas (si existen)
    if (novelties.length > 0) {
      const noveltyData = novelties.map((n) => ({
        'Tipo de Novedad': n.noveltyType,
        'Cantidad Afectada': n.quantity,
        'Lote': n.batchNumber || 'N/A',
        'Vencimiento': n.expirationDate
          ? new Date(n.expirationDate).toLocaleDateString('es-ES')
          : 'N/A',
        'Observaciones': n.notes || '',
        'Reportado Por': n.reportedBy,
        'Fecha': new Date(n.createdAt).toLocaleString('es-ES'),
      }));
      const wsNov = XLSX.utils.json_to_sheet(noveltyData);
      XLSX.utils.book_append_sheet(wb, wsNov, 'Novedades Físicas');
    }

    const cleanTitle = session.title.replace(/[^a-zA-Z0-9-_]/g, '_');
    XLSX.writeFile(wb, `Reporte_Inventario_COMPLETO_${cleanTitle}.xlsx`);
  };

  // EXPORTAR A EXCEL: SOLO NOVEDADES Y DISCREPANCIAS
  const handleExportExcelNovelties = () => {
    const wb = XLSX.utils.book_new();

    const noveltiesItems = itemsList.filter(
      (i) => i.status === 'surplus' || i.status === 'shortage' || i.requiresRecount || i.hasNovelties
    );

    const noveltiesData = noveltiesItems.map((item) => {
      const theo = formatStockBreakdown(item.systemStock, item.packQuantity);
      const counted = formatStockBreakdown(item.totalCounted, item.packQuantity);
      const diffBreakdown = formatStockBreakdown(Math.abs(item.difference), item.packQuantity);

      return {
        'SKU': item.sku,
        'Código de Barras': item.barcode || '',
        'Descripción del Producto': item.description,
        'Ubicación': item.location || '',
        'Factor': `1x${item.packQuantity}`,
        'Stock Teórico': theo.formatted,
        'Físico Contado': counted.formatted,
        'Diferencia Desglose':
          item.difference === 0 ? '0 u' : `${item.difference > 0 ? '+' : '-'}${diffBreakdown.formatted}`,
        'Diferencia Fracciones': item.difference,
        'Impacto Financiero ($)': item.costImpact,
        'Tipo Incidencia':
          item.status === 'surplus'
            ? 'Sobrante (+)'
            : item.status === 'shortage'
            ? 'Faltante (-)'
            : item.requiresRecount
            ? 'Requiere Reconteo'
            : 'Novedad Física',
      };
    });

    const wsNov = XLSX.utils.json_to_sheet(noveltiesData);
    XLSX.utils.book_append_sheet(wb, wsNov, 'Novedades y Discrepancias');

    const cleanTitle = session.title.replace(/[^a-zA-Z0-9-_]/g, '_');
    XLSX.writeFile(wb, `Reporte_SOLO_NOVEDADES_${cleanTitle}.xlsx`);
  };

  // IMPRIMIR REPORTE (Abre el diálogo nativo de impresión)
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Estilos CSS para Impresión Estándar y A6 */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${reportView === 'quick_a6' ? 'A6 portrait' : 'letter portrait'};
            margin: ${reportView === 'quick_a6' ? '4mm' : '8mm'};
          }
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .page-break-a6 {
            page-break-before: always !important;
            break-before: page !important;
          }
        }
        @media screen {
          .print-only {
            display: none;
          }
        }
      `}</style>

      {/* ============================================================== */}
      {/* SECCIÓN SOLO PARA IMPRESIÓN OFICIAL (ENCABEZADO DE ACTA FORMAL) */}
      {/* ============================================================== */}
      {reportView !== 'quick_a6' && (
        <div className="print-only mb-6 border-b-2 border-slate-900 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-wider text-black">
                ACTA OFICIAL DE AUDITORÍA Y CONCILIACIÓN DE INVENTARIO
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                StockSync Pro — Sistema de Control y Trazabilidad Farmacéutica
              </p>
            </div>
            <div className="text-right text-xs">
              <div>Fecha: {new Date().toLocaleDateString('es-ES')}</div>
              <div>Hora: {new Date().toLocaleTimeString('es-ES')}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-300 text-xs">
            <div>
              <strong>Sesión:</strong> {session.title}
            </div>
            <div>
              <strong>Auditor Responsable:</strong> {session.createdBy}
            </div>
            <div>
              <strong>Estado:</strong> {session.status === 'closed' ? 'CERRADA / SELLADA' : 'EN CURSO'}
            </div>
            {session.closedHash && (
              <div className="col-span-3 font-mono text-[10px] mt-1">
                <strong>Sello Criptográfico SHA-256:</strong> {session.closedHash}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ENCABEZADO INTERACTIVO DE PANTALLA */}
      {/* ============================================================== */}
      <div className="no-print bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Link
                href="/reportes"
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                title="Volver al Centro de Reportes"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Reporte de Conciliación
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  session.status === 'closed'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                {session.status === 'closed' ? 'Sellada' : 'En Progreso'}
              </span>
            </div>

            <p className="text-sm text-slate-300 font-medium">{session.title}</p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Auditor: <strong className="text-slate-200">{session.createdBy}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {new Date(session.createdAt).toLocaleDateString('es-ES', { dateStyle: 'long' })}
              </span>
              {session.closedHash && (
                <span className="flex items-center gap-1.5 font-mono text-emerald-400 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  SHA-256: {session.closedHash.slice(0, 16)}...
                </span>
              )}
            </div>
          </div>

          {/* BOTONES DE ACCIÓN: IMPRIMIR, EXPORTAR EXCEL, CERRAR SESIÓN */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer shadow-sm hover:shadow"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcelNovelties}
              className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-2 border border-amber-500/40 transition-all cursor-pointer shadow-sm hover:shadow"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Solo Novedades ({noveltiesOrDiffCount})</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcelFull}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel Completo</span>
            </button>

            {session.status !== 'closed' && (
              <button
                type="button"
                onClick={handleCloseSession}
                disabled={isClosing}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{isClosing ? 'Sellando...' : 'Cerrar y Sellar'}</span>
              </button>
            )}
          </div>
        </div>

        {closeSuccessMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{closeSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* SELECTOR DE VISTAS: DETALLADO vs RÁPIDO (A6) vs CUARENTENA     */}
      {/* ============================================================== */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-900 border border-slate-800 rounded-3xl shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReportView('detailed')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              reportView === 'detailed'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Reporte Detallado</span>
          </button>

          <button
            type="button"
            onClick={() => setReportView('quick_a6')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              reportView === 'quick_a6'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Printer className="w-4 h-4 text-cyan-300" />
            <span>Reporte Rápido (Formato A6 / Factura)</span>
          </button>

          <button
            type="button"
            onClick={() => setReportView('quarantine')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              reportView === 'quarantine'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <span>Productos por Vencer / Cuarentena</span>
            {quarantineCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                {quarantineCount}
              </span>
            )}
          </button>
        </div>

        {reportView === 'quick_a6' && (
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/25 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Tickets A6 (2 Hojas)</span>
          </button>
        )}
      </div>

      {/* ============================================================== */}
      {/* VISTA 1: REPORTE DETALLADO (PANTALLA COMPLETA TRADICIONAL)     */}
      {/* ============================================================== */}
      {reportView === 'detailed' && (
        <div className="space-y-6">
          {/* Tarjetas de Resumen KPI */}
          <div className="no-print grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-cyan-400" />
                Catálogo
              </span>
              <div className="my-2 text-2xl sm:text-3xl font-black text-white">
                {summary.totalItems}
              </div>
              <span className="text-[10px] text-slate-400">Total productos</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Coincidentes
              </span>
              <div className="my-2 text-2xl sm:text-3xl font-black text-emerald-400">
                {matchedCount}
              </div>
              <span className="text-[10px] text-emerald-400">100% Exactitud</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Sobrantes (+)
              </span>
              <div className="my-2 text-2xl sm:text-3xl font-black text-cyan-400">
                {surplusCount}
              </div>
              <span className="text-[10px] text-cyan-400">
                +${summary.totalSurplusCost.toFixed(2)} valorizado
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" />
                Faltantes (-)
              </span>
              <div className="my-2 text-2xl sm:text-3xl font-black text-rose-400">
                {shortageCount}
              </div>
              <span className="text-[10px] text-rose-400">
                -${summary.totalShortageCost.toFixed(2)} valorizado
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Novedades / Rec.
              </span>
              <div className="my-2 text-2xl sm:text-3xl font-black text-amber-300">
                {summary.requiresRecountCount + summary.noveltiesTotal}
              </div>
              <span className="text-[10px] text-amber-400">
                {summary.requiresRecountCount} reconteos • {summary.noveltiesTotal} físicas
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Impacto Neto
              </span>
              <div
                className={`my-2 text-2xl sm:text-3xl font-black ${
                  summary.netCostImpact === 0
                    ? 'text-white'
                    : summary.netCostImpact > 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {summary.netCostImpact >= 0 ? '+' : ''}${summary.netCostImpact.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-400">Diferencia neta monetaria</span>
            </div>
          </div>

          {/* Barra de Filtros y Búsqueda */}
          <div className="no-print bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por nombre, SKU, código de barras o ubicación..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="text-xs text-slate-400">
                Mostrando <strong className="text-white font-mono">{filteredItems.length}</strong> de{' '}
                <strong className="text-white font-mono">{itemsList.length}</strong> productos
              </div>
            </div>

            {/* Categorías de Filtro */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'all'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                Todos ({itemsList.length})
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus('novelties_only')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  filterStatus === 'novelties_only'
                    ? 'bg-amber-500/25 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-slate-800/60 text-amber-400/80 border-slate-800 hover:text-amber-300'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Solo Novedades / Incidencias ({noveltiesOrDiffCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus('matched')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'matched'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-800/60 text-emerald-400 hover:text-white'
                }`}
              >
                Coincidentes ({matchedCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus('surplus')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'surplus'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-slate-800/60 text-cyan-400 hover:text-white'
                }`}
              >
                Sobrantes ({surplusCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus('shortage')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'shortage'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-800/60 text-rose-400 hover:text-white'
                }`}
              >
                Faltantes ({shortageCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus('uncounted')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'uncounted'
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                No Contados ({uncountedCount})
              </button>
            </div>
          </div>

          {/* Tabla de Conciliación Detallada */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Producto / SKU</th>
                    <th className="px-3 py-3.5 text-center">Foto / Etiqueta</th>
                    <th className="px-4 py-3.5 text-center">Factor</th>
                    <th className="px-4 py-3.5 text-right">Stock Teórico</th>
                    <th className="px-4 py-3.5 text-right">Físico Contado</th>
                    <th className="px-4 py-3.5 text-right">Diferencia</th>
                    <th className="px-4 py-3.5 text-right">Impacto $</th>
                    <th className="px-4 py-3.5 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        No se encontraron productos que coincidan con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const theoBreakdown = formatStockBreakdown(item.systemStock, item.packQuantity);
                      const physBreakdown = formatStockBreakdown(item.totalCounted, item.packQuantity);
                      const diffBreakdown = formatStockBreakdown(Math.abs(item.difference), item.packQuantity);

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            item.requiresRecount ? 'bg-amber-500/5' : ''
                          }`}
                        >
                          {/* Producto */}
                          <td className="px-4 py-3 max-w-xs sm:max-w-md">
                            <div className="font-bold text-white text-xs sm:text-sm leading-tight">
                              {item.description}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-2">
                              <span>SKU: {item.sku}</span>
                              {item.barcode && <span>• Barcode: {item.barcode}</span>}
                              {item.location && <span>• Ubic: {item.location}</span>}
                              {item.batchNumber && <span>• Lote: {item.batchNumber}</span>}
                              {item.expirationDate && (
                                <span className="text-amber-400">
                                  • Vence: {new Date(item.expirationDate).toLocaleDateString('es-ES')}
                                </span>
                              )}
                            </div>

                            {/* Badges de Alerta */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {item.requiresRecount && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ⚠️ Requiere Reconteo
                                </span>
                              )}
                              {item.hasNovelties && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  Novedad Física ({item.noveltiesCount})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Foto / Rótulo / Etiqueta */}
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt="Foto"
                                  onClick={() =>
                                    setViewImageModal({ url: item.imageUrl!, title: item.description })
                                  }
                                  className="w-9 h-9 object-cover rounded-lg border border-cyan-500/60 cursor-pointer shadow hover:opacity-80 transition-opacity"
                                  title="Ver foto ampliada"
                                />
                              ) : null}

                              <label
                                className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                  uploadingItemId === item.id
                                    ? 'bg-cyan-600 text-white animate-spin border-cyan-500'
                                    : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border-slate-700'
                                }`}
                                title="Tomar foto con cámara móvil o subir imagen desde PC"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  disabled={uploadingItemId === item.id}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadItemImage(item.id, f);
                                  }}
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() => setActiveLabelItem(item)}
                                className="p-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 cursor-pointer transition-colors"
                                title="Ver / Imprimir Etiqueta de Producto"
                              >
                                <Tag className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Factor */}
                          <td className="px-4 py-3 text-center font-mono text-cyan-400">
                            1x{item.packQuantity}
                          </td>

                          {/* Stock Teórico */}
                          <td className="px-4 py-3 text-right">
                            <div className="font-mono font-bold text-white text-sm">
                              {theoBreakdown.formatted}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ({item.systemStock} fracc.)
                            </div>
                          </td>

                          {/* Físico Contado */}
                          <td className="px-4 py-3 text-right">
                            {item.status === 'uncounted' ? (
                              <span className="text-slate-400 font-mono">Sin conteo</span>
                            ) : (
                              <>
                                <div className="font-mono font-bold text-emerald-300 text-sm">
                                  {physBreakdown.formatted}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  ({item.totalCounted} fracc.)
                                </div>
                              </>
                            )}
                          </td>

                          {/* Diferencia */}
                          <td className="px-4 py-3 text-right font-mono">
                            {item.status === 'uncounted' ? (
                              <span className="text-slate-400">---</span>
                            ) : item.difference === 0 ? (
                              <span className="text-emerald-400 font-bold">0 u (Exacto)</span>
                            ) : (
                              <div>
                                <span
                                  className={`font-bold text-sm ${
                                    item.difference > 0 ? 'text-cyan-400' : 'text-rose-400'
                                  }`}
                                >
                                  {item.difference > 0 ? `+` : `-`}
                                  {diffBreakdown.formatted}
                                </span>
                                <span className="text-[10px] text-slate-400 block font-normal">
                                  ({item.difference > 0 ? `+` : ``}
                                  {item.difference} fracc. • {item.differencePercentage}%)
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Impacto $ */}
                          <td className="px-4 py-3 text-right font-mono font-bold text-xs">
                            {item.costImpact === 0 ? (
                              <span className="text-slate-400">$0.00</span>
                            ) : item.costImpact > 0 ? (
                              <span className="text-cyan-400">+${item.costImpact.toFixed(2)}</span>
                            ) : (
                              <span className="text-rose-400">-${Math.abs(item.costImpact).toFixed(2)}</span>
                            )}
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                item.status === 'matched'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : item.status === 'surplus'
                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                  : item.status === 'shortage'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {item.status === 'matched' && 'Exacto'}
                              {item.status === 'surplus' && 'Sobrante'}
                              {item.status === 'shortage' && 'Faltante'}
                              {item.status === 'uncounted' && 'No contado'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: REPORTE RÁPIDO (FORMATO A6 FACTURA/TICKET - FALTANTES Y SOBRANTES) */}
      {/* ========================================================================= */}
      {reportView === 'quick_a6' && (
        <div className="space-y-8">
          <div className="no-print p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-indigo-400 shrink-0" />
              <span>
                <strong>Formato A6 Estándar (105mm x 148mm):</strong> Hoja 1 contiene el detalle factura de <strong>Faltantes</strong> y Hoja 2 contiene el detalle factura de <strong>Sobrantes</strong>, con salto de página físico automático para impresoras térmicas o mini-hojas.
              </span>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow-md"
            >
              Imprimir en A6
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* ------------------------------------------------------------- */}
            {/* HOJA 1 (A6): TICKET / FACTURA DE PRODUCTOS FALTANTES           */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white text-slate-900 border-2 border-slate-300 rounded-3xl p-6 shadow-2xl space-y-4 max-w-sm mx-auto w-full font-sans text-xs">
              {/* Encabezado Hoja 1 */}
              <div className="border-b-2 border-dashed border-slate-400 pb-3 text-center space-y-1">
                <span className="text-[10px] font-bold tracking-widest uppercase text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full inline-block">
                  HOJA 1 DE 2 • FORMATO A6
                </span>
                <h2 className="text-base font-black uppercase tracking-tight text-slate-900">
                  ACTA DE AJUSTE: FALTANTES
                </h2>
                <p className="text-[10px] text-slate-500">
                  StockSync Pro • Control Oficial de Mermas
                </p>
                <div className="text-[10px] text-slate-600 pt-1 font-mono">
                  Sesión: {session.title.slice(0, 28)}
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 pt-0.5 font-mono">
                  <span>Auditor: {session.createdBy}</span>
                  <span>{new Date().toLocaleDateString('es-ES')}</span>
                </div>
              </div>

              {/* Listado de Productos Faltantes */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-700 border-b border-slate-200 pb-1">
                  <span>Ítem / Faltante</span>
                  <span className="text-right">Pérdida ($)</span>
                </div>

                {shortageItems.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs italic">
                    ¡Excelente! No se registraron productos faltantes en esta auditoría.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {shortageItems.map((item, idx) => {
                      const diffBreakdown = formatStockBreakdown(Math.abs(item.difference), item.packQuantity);
                      const lossUSD = Math.abs(item.costImpact);

                      return (
                        <div
                          key={`shortage-${item.id}-${idx}`}
                          className="border-b border-slate-100 pb-2 text-[11px] space-y-0.5"
                        >
                          <div className="flex justify-between items-start gap-1 font-bold">
                            <span className="text-slate-900 truncate">
                              {idx + 1}. {item.description}
                            </span>
                            <span className="text-rose-600 font-mono shrink-0">
                              -${lossUSD.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>
                              SKU: {item.sku} • 1x{item.packQuantity}
                            </span>
                            <span className="text-rose-700 font-bold">
                              -{diffBreakdown.formatted} ({Math.abs(item.difference)} fracc.)
                            </span>
                          </div>
                          {item.batchNumber && (
                            <div className="text-[9px] text-slate-400 font-mono">
                              Lote: {item.batchNumber}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Totalizador de Pérdida Faltante */}
              <div className="border-t-2 border-dashed border-slate-400 pt-3 space-y-1">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Ítems con Faltante:</span>
                  <span className="font-mono font-bold">{shortageItems.length}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-rose-700 pt-1">
                  <span>TOTAL PÉRDIDA:</span>
                  <span className="font-mono">-${summary.totalShortageCost.toFixed(2)} USD</span>
                </div>
              </div>

              {/* Firmas Hoja 1 */}
              <div className="pt-4 grid grid-cols-2 gap-4 text-center text-[9px] border-t border-slate-200">
                <div>
                  <div className="border-b border-slate-400 h-8 mb-1"></div>
                  <strong>Firma Auditor</strong>
                  <p className="text-slate-500">{session.createdBy}</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 h-8 mb-1"></div>
                  <strong>Responsable Bodega</strong>
                  <p className="text-slate-500">Recibido Conforme</p>
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* HOJA 2 (A6): TICKET / FACTURA DE PRODUCTOS SOBRANTES          */}
            {/* ------------------------------------------------------------- */}
            <div className="page-break-a6 bg-white text-slate-900 border-2 border-slate-300 rounded-3xl p-6 shadow-2xl space-y-4 max-w-sm mx-auto w-full font-sans text-xs">
              {/* Encabezado Hoja 2 */}
              <div className="border-b-2 border-dashed border-slate-400 pb-3 text-center space-y-1">
                <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full inline-block">
                  HOJA 2 DE 2 • FORMATO A6
                </span>
                <h2 className="text-base font-black uppercase tracking-tight text-slate-900">
                  ACTA DE AJUSTE: SOBRANTES
                </h2>
                <p className="text-[10px] text-slate-500">
                  StockSync Pro • Control Oficial de Excedentes
                </p>
                <div className="text-[10px] text-slate-600 pt-1 font-mono">
                  Sesión: {session.title.slice(0, 28)}
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 pt-0.5 font-mono">
                  <span>Auditor: {session.createdBy}</span>
                  <span>{new Date().toLocaleDateString('es-ES')}</span>
                </div>
              </div>

              {/* Listado de Productos Sobrantes */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-700 border-b border-slate-200 pb-1">
                  <span>Ítem / Sobrante</span>
                  <span className="text-right">Excedente ($)</span>
                </div>

                {surplusItems.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs italic">
                    No se registraron productos sobrantes en esta auditoría.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {surplusItems.map((item, idx) => {
                      const diffBreakdown = formatStockBreakdown(item.difference, item.packQuantity);
                      const surplusUSD = item.costImpact;

                      return (
                        <div
                          key={`surplus-${item.id}-${idx}`}
                          className="border-b border-slate-100 pb-2 text-[11px] space-y-0.5"
                        >
                          <div className="flex justify-between items-start gap-1 font-bold">
                            <span className="text-slate-900 truncate">
                              {idx + 1}. {item.description}
                            </span>
                            <span className="text-emerald-600 font-mono shrink-0">
                              +${surplusUSD.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>
                              SKU: {item.sku} • 1x{item.packQuantity}
                            </span>
                            <span className="text-emerald-700 font-bold">
                              +{diffBreakdown.formatted} (+{item.difference} fracc.)
                            </span>
                          </div>
                          {item.batchNumber && (
                            <div className="text-[9px] text-slate-400 font-mono">
                              Lote: {item.batchNumber}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Totalizador de Excedente Sobrante */}
              <div className="border-t-2 border-dashed border-slate-400 pt-3 space-y-1">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Ítems con Sobrante:</span>
                  <span className="font-mono font-bold">{surplusItems.length}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-emerald-700 pt-1">
                  <span>TOTAL EXCEDENTE:</span>
                  <span className="font-mono">+${summary.totalSurplusCost.toFixed(2)} USD</span>
                </div>
              </div>

              {/* Firmas Hoja 2 */}
              <div className="pt-4 grid grid-cols-2 gap-4 text-center text-[9px] border-t border-slate-200">
                <div>
                  <div className="border-b border-slate-400 h-8 mb-1"></div>
                  <strong>Firma Auditor</strong>
                  <p className="text-slate-500">{session.createdBy}</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 h-8 mb-1"></div>
                  <strong>Responsable Bodega</strong>
                  <p className="text-slate-500">Recibido Conforme</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: PRODUCTOS POR VENCER / CUSTODIA Y CUARENTENA (< 3 MESES)         */}
      {/* ========================================================================= */}
      {reportView === 'quarantine' && (
        <div className="space-y-6">
          {/* Tarjetas KPI de Vencimientos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  Próximos a Vencer (&lt; 3 Meses)
                </span>
                <span className="text-2xl font-black text-amber-300 font-mono mt-1 block">
                  {quarantineCount}
                </span>
                <span className="text-[10px] text-amber-400/80">Marcar para custodia / cuarentena</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-rose-500/30 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                  Productos Vencidos
                </span>
                <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">
                  {expiredCount}
                </span>
                <span className="text-[10px] text-rose-400/80">Retiro inmediato de anaquel</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertOctagon className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                  Productos Vigentes (&gt; 3 Meses)
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
                  {validCount}
                </span>
                <span className="text-[10px] text-emerald-400/80">En regla para dispensación</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filtros de Vencimiento */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por producto, SKU o lote..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setQuarantineFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    quarantineFilter === 'all'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({expiringProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQuarantineFilter('quarantine')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
                    quarantineFilter === 'quarantine'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-amber-400 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Próximos &lt; 3 meses ({quarantineCount})
                </button>
                <button
                  type="button"
                  onClick={() => setQuarantineFilter('expired')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    quarantineFilter === 'expired'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-rose-400 hover:text-white'
                  }`}
                >
                  Vencidos ({expiredCount})
                </button>
              </div>
            </div>
          </div>

          {/* Listado de Productos por Vencer / Cuarentena */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Producto / SKU</th>
                    <th className="px-3 py-3.5 text-center">Foto / Etiqueta</th>
                    <th className="px-4 py-3.5">Lote / Batch</th>
                    <th className="px-4 py-3.5">Fecha Vencimiento</th>
                    <th className="px-4 py-3.5 text-center">Días Restantes</th>
                    <th className="px-4 py-3.5 text-center">Estado / Alerta de Cuarentena</th>
                    <th className="px-4 py-3.5 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredExpiringProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                        No se registran productos con fechas de vencimiento en los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredExpiringProducts.map((p) => {
                      const stockBreakdown = formatStockBreakdown(p.stock, p.packQuantity);

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            p.status === 'quarantine'
                              ? 'bg-amber-500/10'
                              : p.status === 'expired'
                              ? 'bg-rose-500/10'
                              : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-bold text-white block text-sm">{p.description}</span>
                            <span className="font-mono text-slate-400 text-[11px]">
                              SKU: {p.sku} {p.location ? `• Ubic: ${p.location}` : ''}
                            </span>
                          </td>

                          {/* Foto / Rótulo de Cuarentena */}
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt="Foto"
                                  onClick={() =>
                                    setViewImageModal({ url: p.imageUrl!, title: p.description })
                                  }
                                  className="w-9 h-9 object-cover rounded-lg border border-amber-500/60 cursor-pointer shadow hover:opacity-80 transition-opacity"
                                  title="Ver foto ampliada"
                                />
                              ) : null}

                              <label
                                className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                  uploadingItemId === p.id
                                    ? 'bg-amber-600 text-white animate-spin border-amber-500'
                                    : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
                                }`}
                                title="Tomar foto de etiqueta o producto con cámara móvil o PC"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  disabled={uploadingItemId === p.id}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadItemImage(p.id, f);
                                  }}
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() => {
                                  const matching = itemsList.find((x) => x.id === p.id);
                                  if (matching) {
                                    setActiveLabelItem(matching);
                                  } else {
                                    setActiveLabelItem({
                                      id: p.id,
                                      sku: p.sku,
                                      barcode: null,
                                      description: p.description,
                                      location: p.location,
                                      packQuantity: p.packQuantity,
                                      systemStock: p.stock,
                                      unitCostCalculated: 0,
                                      requiresRecount: false,
                                      totalCounted: p.stock,
                                      countedPacks: 0,
                                      countedLoose: 0,
                                      difference: 0,
                                      differencePercentage: 0,
                                      costImpact: 0,
                                      countsCount: 1,
                                      status: 'matched',
                                      hasNovelties: false,
                                      noveltiesCount: 0,
                                      batchNumber: p.batchNumber,
                                      expirationDate: p.expirationDate,
                                      imageUrl: p.imageUrl,
                                    });
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-700/60 cursor-pointer transition-colors"
                                title="Ver / Imprimir Etiqueta de Custodia"
                              >
                                <Tag className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono text-cyan-300 font-bold">
                            {p.batchNumber || 'Sin Lote'}
                          </td>

                          <td className="px-4 py-3 font-mono font-bold text-white">
                            {p.expirationDate.toLocaleDateString('es-ES')}
                          </td>

                          <td className="px-4 py-3 text-center font-mono font-bold">
                            {p.daysDiff <= 0 ? (
                              <span className="text-rose-400">Hace {Math.abs(p.daysDiff)} días</span>
                            ) : (
                              <span className={p.daysDiff <= 90 ? 'text-amber-300' : 'text-emerald-400'}>
                                {p.daysDiff} días
                              </span>
                            )}
                          </td>

                          {/* Etiqueta Solicitada de Cuarentena (< 3 meses) */}
                          <td className="px-4 py-3 text-center">
                            {p.status === 'quarantine' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black bg-amber-400 text-slate-950 border border-amber-300 shadow-md shadow-amber-400/20 animate-pulse">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                ⚠️ PRÓXIMO A VENCER (&lt; 3 MESES) - MARCAR PARA CUSTODIA O CUARENTENA
                              </span>
                            ) : p.status === 'expired' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                <AlertOctagon className="w-3.5 h-3.5" />
                                🔴 PRODUCTO VENCIDO
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                🟢 VIGENTE
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-mono font-bold text-white">
                            {stockBreakdown.formatted}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: GENERADOR & VISOR DE ETIQUETA FÍSICA / CUSTODIA CON FOTO */}
      {/* ============================================================== */}
      {activeLabelItem && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setActiveLabelItem(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
                Control de Identificación & Custodia
              </span>
              <h2 className="text-base font-bold text-white mt-0.5">
                Rótulo / Etiqueta Adhesiva de Producto
              </h2>
            </div>

            {/* Rótulo Físico Adhesivo (Diseño Blanco Listo para Impresión o Pegado en Gaveta) */}
            <div className="bg-white text-slate-900 p-5 rounded-2xl border-2 border-dashed border-slate-400 space-y-3 font-sans shadow-lg">
              <div className="flex items-start justify-between border-b border-slate-200 pb-2.5">
                <div>
                  <span className="text-[9px] font-bold tracking-widest uppercase text-slate-500 block">
                    StockSync Pro • Rótulo de Bodega
                  </span>
                  <div className="font-mono text-sm font-black text-slate-900 mt-0.5">
                    SKU: {activeLabelItem.sku}
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono">
                    Factor: 1x{activeLabelItem.packQuantity}
                  </div>
                </div>
                {activeLabelItem.barcode ? (
                  <div className="text-right">
                    <Barcode className="w-10 h-7 text-slate-800 ml-auto" />
                    <span className="font-mono text-[9px] text-slate-600 block">{activeLabelItem.barcode}</span>
                  </div>
                ) : (
                  <div className="px-2 py-1 bg-slate-100 rounded text-[9px] font-mono text-slate-500">
                    Sin Código Barras
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-black text-sm text-slate-900 leading-snug">
                  {activeLabelItem.description}
                </h3>
                <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap gap-2.5 font-mono">
                  <span>Ubicación: <strong>{activeLabelItem.location || 'Bodega'}</strong></span>
                  <span>Lote: <strong>{activeLabelItem.batchNumber || 'Sin Lote'}</strong></span>
                </div>
              </div>

              {/* Estado de Vencimiento / Cuarentena */}
              {activeLabelItem.expirationDate ? (() => {
                const exp = new Date(activeLabelItem.expirationDate);
                const diffDays = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (diffDays <= 0) {
                  return (
                    <div className="bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-center">
                      🔴 PRODUCTO VENCIDO ({exp.toLocaleDateString('es-ES')}) - RETIRAR DE ANAQUEL
                    </div>
                  );
                }
                if (diffDays <= 90) {
                  return (
                    <div className="bg-amber-100 border-2 border-amber-400 text-amber-900 text-[10px] font-black px-2.5 py-1.5 rounded-lg text-center animate-pulse">
                      ⚠️ CUSTODIA / CUARENTENA (&lt; 3 MESES - Vence: {exp.toLocaleDateString('es-ES')})
                    </div>
                  );
                }
                return (
                  <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-center">
                    🟢 CONFORME (Vence: {exp.toLocaleDateString('es-ES')})
                  </div>
                );
              })() : (
                <div className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded text-center">
                  Sin fecha de vencimiento registrada
                </div>
              )}

              {/* Foto Adjunta en la Etiqueta */}
              {activeLabelItem.imageUrl ? (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                  <img
                    src={activeLabelItem.imageUrl}
                    alt="Evidencia"
                    onClick={() =>
                      setViewImageModal({
                        url: activeLabelItem.imageUrl!,
                        title: activeLabelItem.description,
                      })
                    }
                    className="w-16 h-16 object-cover rounded-xl border border-slate-300 cursor-pointer shadow hover:opacity-85"
                  />
                  <div className="text-[10px] text-slate-600">
                    <strong className="block text-slate-900">Evidencia Fotográfica</strong>
                    <span>Foto registrada desde dispositivo</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Controles para cambiar / subir imagen en el rótulo */}
            <div className="flex items-center justify-between text-xs pt-1 gap-2">
              <label className="cursor-pointer px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-bold flex items-center gap-2 transition-colors">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>
                  {activeLabelItem.imageUrl
                    ? 'Cambiar Foto (Móvil / PC)'
                    : 'Tomar Foto / Subir Imagen'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadItemImage(activeLabelItem.id, f);
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-cyan-600/30 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Rótulo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: VISOR DE IMAGEN AMPLIADA                                */}
      {/* ============================================================== */}
      {viewImageModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-4 space-y-3 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white truncate max-w-[340px]">
                {viewImageModal.title}
              </span>
              <button
                type="button"
                onClick={() => setViewImageModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[75vh]">
              <img
                src={viewImageModal.url}
                alt={viewImageModal.title}
                className="w-full h-auto object-contain max-h-[75vh]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECCIÓN SOLO PARA IMPRESIÓN (FIRMAS OFICIALES DE CONFORMIDAD) */}
      {/* ============================================================== */}
      {reportView !== 'quick_a6' && (
        <div className="print-only mt-12 pt-8 border-t border-slate-400 page-break">
          <h3 className="font-bold text-xs uppercase mb-6 text-center">
            FIRMAS DE CONFORMIDAD Y CERTIFICACIÓN DEL INVENTARIO FÍSICO
          </h3>
          <div className="grid grid-cols-3 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-black h-12 mb-2"></div>
              <strong>Auditor Responsable</strong>
              <p className="text-[10px] text-slate-600">{session.createdBy}</p>
            </div>
            <div>
              <div className="border-b border-black h-12 mb-2"></div>
              <strong>Jefe de Almacén / Farmacia</strong>
              <p className="text-[10px] text-slate-600">Nombre y Firma</p>
            </div>
            <div>
              <div className="border-b border-black h-12 mb-2"></div>
              <strong>Gerencia / Control Interno</strong>
              <p className="text-[10px] text-slate-600">Visto Bueno y Aprobación</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
