'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  ShieldAlert,
  Tag,
  Shield,
  FileText,
  Camera,
  Image as ImageIcon,
  Eye,
  Share2,
  ExternalLink,
  Copy,
  Globe,
  LayoutGrid,
  Table as TableIcon,
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
  shareToken?: string;
  isPublicView?: boolean;
}

export default function ReportClient({
  session: initialSession,
  consolidated,
  summary,
  novelties,
  shareToken,
  isPublicView = false,
}: Props) {
  const [session, setSession] = useState(initialSession);
  const [itemsList, setItemsList] = useState<ConsolidatedItem[]>(consolidated);
  const [reportView, setReportView] = useState<'detailed' | 'quick_a6' | 'quarantine'>('detailed');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quarantineFilter, setQuarantineFilter] = useState<'all' | 'quarantine' | 'expired' | 'valid'>('all');
  const [isClosing, setIsClosing] = useState(false);
  const [closeSuccessMsg, setCloseSuccessMsg] = useState<string | null>(null);

  // Estado para Link Público en Línea y Modal de PDF Interactivo
  const [publicShareUrl, setPublicShareUrl] = useState<string>('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && shareToken) {
      setPublicShareUrl(`${window.location.origin}/compartir/${session.id}?key=${shareToken}`);
    }
  }, [session.id, shareToken]);

  // Soporte para auto-impresión si la URL contiene ?print=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('print') === 'true') {
        setTimeout(() => {
          window.print();
        }, 800);
      }
    }
  }, []);

  const handleCopyShareLink = async () => {
    if (!publicShareUrl) return;
    try {
      await navigator.clipboard.writeText(publicShareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      alert('Copia manual: ' + publicShareUrl);
    }
  };

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

  // Paginación a 30 ítems por página / hoja
  const ITEMS_PER_PAGE = 30;
  const [discrepancyPage, setDiscrepancyPage] = useState(1);
  const [compliantPage, setCompliantPage] = useState(1);
  const [showCompliantSection, setShowCompliantSection] = useState(false);
  const [mobileCardMode, setMobileCardMode] = useState(true);

  // Conteo de discrepancias y novedades para insignias
  const noveltiesOrDiffCount = itemsList.filter(
    (i) => i.status === 'surplus' || i.status === 'shortage' || i.requiresRecount || i.hasNovelties
  ).length;

  const surplusCount = itemsList.filter((i) => i.status === 'surplus' || i.difference > 0).length;
  const shortageCount = itemsList.filter((i) => i.status === 'shortage' || i.difference < 0).length;
  const uncountedCount = itemsList.filter((i) => i.status === 'uncounted').length;
  const matchedCount = itemsList.filter((i) => (i.status === 'matched' || i.difference === 0) && !i.hasNovelties && !i.requiresRecount).length;

  // Listados específicos para los Tickets A6
  const shortageItems = useMemo(
    () => itemsList.filter((i) => i.status === 'shortage' || i.difference < 0),
    [itemsList]
  );
  const surplusItems = useMemo(
    () => itemsList.filter((i) => i.status === 'surplus' || i.difference > 0),
    [itemsList]
  );

  // 1. Resumen Priorizado de Novedades y Discrepancias (Faltantes primero, luego Sobrantes)
  const discrepancyItems = useMemo(() => {
    return itemsList
      .filter(
        (i) =>
          i.status === 'shortage' ||
          i.status === 'surplus' ||
          i.difference !== 0 ||
          i.requiresRecount ||
          i.hasNovelties
      )
      .sort((a, b) => {
        // Faltantes (diferencias negativas) primero, ordenadas por mayor merma
        if (a.difference < 0 && b.difference >= 0) return -1;
        if (a.difference >= 0 && b.difference < 0) return 1;
        if (a.difference < 0 && b.difference < 0) return a.difference - b.difference;
        // Sobrantes (diferencias positivas), mayores primero
        return b.difference - a.difference;
      });
  }, [itemsList]);

  // 2. Ítems Conformes (100% Exactos sin diferencias)
  const compliantItems = useMemo(() => {
    return itemsList.filter(
      (i) =>
        i.difference === 0 &&
        i.status !== 'shortage' &&
        i.status !== 'surplus' &&
        !i.requiresRecount &&
        !i.hasNovelties
    );
  }, [itemsList]);

  // Chunks de exactamente 30 ítems por hoja para Impresión Oficial en PDF
  const discrepancyPrintChunks = useMemo(() => {
    if (discrepancyItems.length === 0) return [[]];
    const chunks: ConsolidatedItem[][] = [];
    for (let i = 0; i < discrepancyItems.length; i += ITEMS_PER_PAGE) {
      chunks.push(discrepancyItems.slice(i, i + ITEMS_PER_PAGE));
    }
    return chunks;
  }, [discrepancyItems]);

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

  // Filtrado de items consolidados para vista general
  const filteredItems = itemsList.filter((item) => {
    const q = searchQuery.toLowerCase();
    const itemInternal = (
      (item as any).internalCode ||
      (item as any).rawMetadata?.codId ||
      (item as any).rawMetadata?.internalCode ||
      item.sku ||
      ''
    ).toLowerCase();
    const itemBarcode = (
      item.barcode ||
      (item as any).rawMetadata?.barcode ||
      ''
    ).toLowerCase();
    const matchesSearch =
      item.description.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      itemInternal.includes(q) ||
      itemBarcode.includes(q) ||
      (item.location && item.location.toLowerCase().includes(q));

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

  // 1. Filtrado y paginación a 30 ítems para el Resumen de Novedades y Discrepancias (Pantalla)
  const filteredDiscrepancyItems = useMemo(() => {
    return discrepancyItems.filter((item) => {
      const q = searchQuery.toLowerCase();
      const itemInternal = (
        (item as any).internalCode ||
        (item as any).rawMetadata?.codId ||
        (item as any).rawMetadata?.internalCode ||
        item.sku ||
        ''
      ).toLowerCase();
      const itemBarcode = (
        item.barcode ||
        (item as any).rawMetadata?.barcode ||
        ''
      ).toLowerCase();
      const matchesSearch =
        item.description.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        itemInternal.includes(q) ||
        itemBarcode.includes(q) ||
        (item.location && item.location.toLowerCase().includes(q));

      if (!matchesSearch) return false;
      if (filterStatus === 'all' || filterStatus === 'novelties_only') return true;
      if (filterStatus === 'shortage') return item.status === 'shortage' || item.difference < 0;
      if (filterStatus === 'surplus') return item.status === 'surplus' || item.difference > 0;
      if (filterStatus === 'recount') return item.requiresRecount;
      return true;
    });
  }, [discrepancyItems, searchQuery, filterStatus]);

  const totalDiscrepancyPages = Math.max(1, Math.ceil(filteredDiscrepancyItems.length / ITEMS_PER_PAGE));

  const paginatedDiscrepancies = useMemo(() => {
    const start = (discrepancyPage - 1) * ITEMS_PER_PAGE;
    return filteredDiscrepancyItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDiscrepancyItems, discrepancyPage]);

  // 2. Filtrado y paginación para Ítems Conformes (Pantalla)
  const filteredCompliantItems = useMemo(() => {
    return compliantItems.filter((item) => {
      const q = searchQuery.toLowerCase();
      const itemInternal = (
        (item as any).internalCode ||
        (item as any).rawMetadata?.codId ||
        (item as any).rawMetadata?.internalCode ||
        item.sku ||
        ''
      ).toLowerCase();
      const itemBarcode = (
        item.barcode ||
        (item as any).rawMetadata?.barcode ||
        ''
      ).toLowerCase();
      return (
        item.description.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        itemInternal.includes(q) ||
        itemBarcode.includes(q) ||
        (item.location && item.location.toLowerCase().includes(q))
      );
    });
  }, [compliantItems, searchQuery]);

  const totalCompliantPages = Math.max(1, Math.ceil(filteredCompliantItems.length / ITEMS_PER_PAGE));

  const paginatedCompliant = useMemo(() => {
    const start = (compliantPage - 1) * ITEMS_PER_PAGE;
    return filteredCompliantItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCompliantItems, compliantPage]);

  // Resetear a página 1 cuando cambia búsqueda o filtro
  useEffect(() => {
    setDiscrepancyPage(1);
    setCompliantPage(1);
  }, [searchQuery, filterStatus]);

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
      { Parámetro: 'Ítems con Conteo Duplicado', Valor: itemsList.filter((i) => i.locationsCount > 1).length },
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
      const locationsText = item.locationsCount > 0
        ? item.locations.join(' | ')
        : (item.location || '');
      const hasMultipleLocations = item.locationsCount > 1;

      return {
        'SKU': item.sku,
        'Código de Barras': item.barcode || '',
        'Descripción del Producto': item.description,
        'Ubicación (Catálogo)': item.location || '',
        'Ubicaciones de Conteo': locationsText,
        'Veces Contado': item.locationsCount > 0 ? item.locationsCount : (item.countsCount > 0 ? item.countsCount : 0),
        'Conteo Duplicado': hasMultipleLocations ? 'SÍ' : 'NO',
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
          .page-break {
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
          <div className="flex justify-between items-start gap-4">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-wider text-black">
                ACTA OFICIAL DE AUDITORÍA Y CONCILIACIÓN DE INVENTARIO
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                StockSync Pro — Sistema de Control y Trazabilidad Farmacéutica (Respaldo Supabase)
              </p>
            </div>
            <div className="text-right text-xs shrink-0">
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

          {/* LINK INTERACTIVO Y QR INCRUSTADO EN EL PDF */}
          {publicShareUrl && (
            <div className="mt-3 p-3 rounded-xl border-2 border-cyan-700 bg-cyan-50/60 flex items-center justify-between gap-4">
              <div className="space-y-1 text-left">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-900">
                  🌐 VERSIÓN INTERACTIVA EN LÍNEA (VERCEL + SUPABASE CLOUD)
                </div>
                <p className="text-[10px] text-slate-700">
                  Haz clic en el siguiente enlace dentro del PDF o escanea el código QR para abrir la versión detallada e interactiva en vivo:
                </p>
                <a
                  href={publicShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block font-mono text-[10px] font-bold text-blue-700 underline break-all"
                >
                  {publicShareUrl}
                </a>
              </div>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(publicShareUrl)}`}
                alt="QR Informe en Línea"
                className="w-16 h-16 border border-slate-300 rounded p-0.5 bg-white shrink-0"
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN SOLO PARA IMPRESIÓN (PDF): RESUMEN DE NOVEDADES (30 ÍTEMS POR HOJA) */}
      {/* ========================================================================= */}
      {reportView === 'detailed' && (
        <div className="print-only">
          {discrepancyPrintChunks.map((chunk, pageIndex) => {
            const startItemIdx = pageIndex * ITEMS_PER_PAGE + 1;
            const endItemIdx = Math.min((pageIndex + 1) * ITEMS_PER_PAGE, discrepancyItems.length);

            return (
              <div
                key={`print-discrepancy-page-${pageIndex}`}
                className={pageIndex > 0 ? 'page-break pt-4' : 'pt-1'}
              >
                {/* Encabezado por Hoja de Impresión */}
                <div className="border-b-2 border-slate-900 pb-2 mb-2">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-black">
                        ACTA DE DISCREPANCIAS Y NOVEDADES (FALTANTES Y SOBRANTES)
                      </h2>
                      <p className="text-[9.5px] text-slate-600">
                        StockSync Pro • Conciliación Oficial de Inventario ({session.title})
                      </p>
                    </div>
                    <div className="text-right text-[9.5px] font-mono shrink-0">
                      <span className="font-bold px-2 py-0.5 border border-slate-900 rounded bg-slate-100">
                        Hoja {pageIndex + 1} de {discrepancyPrintChunks.length}
                      </span>
                      <div className="text-slate-500 mt-0.5">
                        {discrepancyItems.length > 0
                          ? `Ítems ${startItemIdx} - ${endItemIdx} de ${discrepancyItems.length}`
                          : '0 discrepancias'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla de Discrepancias (Exactamente ~30 filas por hoja) */}
                <table className="w-full text-[9px] border-collapse border border-slate-400">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-bold">
                      <th className="border border-slate-400 p-1 text-center w-7">#</th>
                      <th className="border border-slate-400 p-1 text-left w-20">SKU / Ubic</th>
                      <th className="border border-slate-400 p-1 text-left">Descripción del Producto</th>
                      <th className="border border-slate-400 p-1 text-center w-12">Factor</th>
                      <th className="border border-slate-400 p-1 text-right w-16">Sistema</th>
                      <th className="border border-slate-400 p-1 text-right w-16">Físico</th>
                      <th className="border border-slate-400 p-1 text-right w-20">Diferencia</th>
                      <th className="border border-slate-400 p-1 text-right w-16">Impacto $</th>
                      <th className="border border-slate-400 p-1 text-center w-16">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunk.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="border border-slate-400 p-4 text-center text-slate-600 font-semibold text-[10px]"
                        >
                          100% CONCILIADO — No se registraron faltantes, sobrantes ni novedades.
                        </td>
                      </tr>
                    ) : (
                      chunk.map((item, itemIdx) => {
                        const globalIdx = pageIndex * ITEMS_PER_PAGE + itemIdx + 1;
                        const theoBreakdown = formatStockBreakdown(item.systemStock, item.packQuantity);
                        const physBreakdown = formatStockBreakdown(item.totalCounted, item.packQuantity);
                        const diffBreakdown = formatStockBreakdown(
                          Math.abs(item.difference),
                          item.packQuantity
                        );

                        return (
                          <tr key={item.id} className="border-b border-slate-300">
                            <td className="border border-slate-400 p-0.5 text-center font-mono font-bold text-slate-700">
                              {globalIdx}
                            </td>
                            <td className="border border-slate-400 p-0.5 font-mono text-slate-900 leading-tight">
                              <div className="font-bold">{item.sku}</div>
                              {item.location && (
                                <div className="text-[7.5px] text-slate-500">{item.location}</div>
                              )}
                            </td>
                            <td className="border border-slate-400 p-0.5 text-slate-900 leading-tight">
                              <div className="font-semibold truncate max-w-[230px]">{item.description}</div>
                              {(item.batchNumber || item.expirationDate) && (
                                <div className="text-[7.5px] text-slate-500 font-mono">
                                  {item.batchNumber && <span>Lote: {item.batchNumber} </span>}
                                  {item.expirationDate && (
                                    <span>
                                      Vence: {new Date(item.expirationDate).toLocaleDateString('es-ES')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="border border-slate-400 p-0.5 text-center font-mono text-slate-700">
                              1x{item.packQuantity}
                            </td>
                            <td className="border border-slate-400 p-0.5 text-right font-mono text-slate-900">
                              {theoBreakdown.formatted}
                            </td>
                            <td className="border border-slate-400 p-0.5 text-right font-mono font-bold text-slate-900">
                              {physBreakdown.formatted}
                            </td>
                            <td className="border border-slate-400 p-0.5 text-right font-mono font-bold">
                              <span className={item.difference < 0 ? 'text-red-700' : 'text-blue-700'}>
                                {item.difference > 0 ? '+' : '-'}
                                {diffBreakdown.formatted}
                              </span>
                            </td>
                            <td className="border border-slate-400 p-0.5 text-right font-mono font-bold">
                              {item.costImpact === 0 ? (
                                '$0.00'
                              ) : item.costImpact > 0 ? (
                                <span className="text-blue-700">+${item.costImpact.toFixed(2)}</span>
                              ) : (
                                <span className="text-red-700">
                                  -${Math.abs(item.costImpact).toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="border border-slate-400 p-0.5 text-center font-bold text-[8px]">
                              {item.status === 'shortage' && (
                                <span className="text-red-700 uppercase">Faltante</span>
                              )}
                              {item.status === 'surplus' && (
                                <span className="text-blue-700 uppercase">Sobrante</span>
                              )}
                              {item.hasNovelties && (
                                <span className="text-amber-700 uppercase">Novedad</span>
                              )}
                              {item.requiresRecount && (
                                <span className="text-purple-700 uppercase">Reconteo</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Subtotales en la última hoja de discrepancias */}
                {pageIndex === discrepancyPrintChunks.length - 1 && (
                  <div className="mt-2.5 p-2 border border-slate-400 bg-slate-50 text-[9.5px] grid grid-cols-4 gap-2 text-center">
                    <div>
                      <span className="block text-slate-500 font-medium">Total Faltantes:</span>
                      <strong className="text-red-700 font-mono font-bold">
                        {shortageCount} ítems (-${summary.totalShortageCost.toFixed(2)})
                      </strong>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-medium">Total Sobrantes:</span>
                      <strong className="text-blue-700 font-mono font-bold">
                        {surplusCount} ítems (+${summary.totalSurplusCost.toFixed(2)})
                      </strong>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-medium">Impacto Neto:</span>
                      <strong
                        className={`font-mono font-bold ${
                          summary.netCostImpact < 0 ? 'text-red-700' : 'text-blue-700'
                        }`}
                      >
                        {summary.netCostImpact >= 0 ? '+' : ''}${summary.netCostImpact.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-medium">Novedades / Rec.:</span>
                      <strong className="text-amber-700 font-mono font-bold">
                        {summary.requiresRecountCount + summary.noveltiesTotal}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* BANNER SUPERIOR DE MODO PÚBLICO / ESTÁTICO EN LÍNEA */}
      {isPublicView && (
        <div className="no-print bg-[#141416] border border-white/[0.08] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-white">
                  Informe Oficial Interactivo en Línea (Solo Lectura)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Verificado
                </span>
              </div>
              <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                Consulta faltantes/sobrantes, fotografías de evidencia, vista A6 y descarga de datos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ENCABEZADO INTERACTIVO DE PANTALLA */}
      {/* ============================================================== */}
      <div className="no-print bg-[#141416] border border-white/[0.08] rounded-2xl p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {!isPublicView && (
                <Link
                  href="/reportes"
                  className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-[#A1A1AA] hover:text-white flex items-center justify-center transition-colors"
                  title="Volver al Centro de Reportes"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Reporte de Conciliación
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-medium border ${
                  session.status === 'closed'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                }`}
              >
                {session.status === 'closed' ? 'Sellada' : 'En Progreso'}
              </span>
            </div>

            <p className="text-sm text-[#D4D4D8] font-medium">{session.title}</p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#71717A]">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#71717A]" />
                Auditor: <strong className="text-[#D4D4D8] font-medium">{session.createdBy}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#71717A]" />
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

          {/* BOTONES DE ACCIÓN: COMPARTIR LINK/PDF, IMPRIMIR, EXPORTAR EXCEL, CERRAR SESIÓN */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
            {publicShareUrl && (
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="col-span-2 sm:col-span-1 px-4 py-2 rounded-lg bg-white hover:bg-[#E4E4E7] text-[#0C0C0E] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span className="truncate">Compartir Reporte</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="truncate">Imprimir / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcelNovelties}
              className="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 border border-amber-500/40 transition-all cursor-pointer shadow-sm"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">Novedades ({noveltiesOrDiffCount})</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcelFull}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span className="truncate">Excel Completo</span>
            </button>

            {!isPublicView && session.status !== 'closed' && (
              <button
                type="button"
                onClick={handleCloseSession}
                disabled={isClosing}
                className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                <Lock className="w-4 h-4 shrink-0" />
                <span className="truncate">{isClosing ? 'Sellando...' : 'Cerrar y Sellar'}</span>
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
            className={`px-4 py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer ${
              reportView === 'quick_a6'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-[#71717A] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Printer className="w-4 h-4 text-[#A1A1AA]" />
            <span>Reporte Rápido (Formato A6)</span>
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
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-semibold text-[10px]">
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
          {/* Tarjetas de Resumen KPI (DISEÑO MÓVIL Y DESKTOP ADAPTABLE) */}
          <div className="no-print grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <div className="bg-[#141522] border border-white/[0.06] p-3 sm:p-4 rounded-2xl flex flex-col justify-between shadow-lg">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <Package className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                Catálogo
              </span>
              <div className="my-1.5 text-xl sm:text-2xl font-semibold text-white">
                {summary.totalItems}
              </div>
              <span className="text-[10px] text-slate-500">Total productos</span>
            </div>

            <div className="bg-[#141522] border border-white/[0.06] p-3 sm:p-4 rounded-2xl flex flex-col justify-between shadow-lg">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Coincidentes
              </span>
              <div className="my-1.5 text-xl sm:text-2xl font-semibold text-emerald-400">
                {matchedCount}
              </div>
              <span className="text-[10px] text-emerald-500 font-medium">100% Exactitud</span>
            </div>

            <div className="bg-[#141522] border border-white/[0.06] p-3 sm:p-4 rounded-2xl flex flex-col justify-between shadow-lg">
              <span className="text-[10px] sm:text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                Sobrantes (+)
              </span>
              <div className="my-1.5 text-xl sm:text-2xl font-semibold text-cyan-400">
                {surplusCount}
              </div>
              <span className="text-[10px] text-cyan-400 truncate">
                +${summary.totalSurplusCost.toFixed(2)}
              </span>
            </div>

            <div className="bg-[#141522] border border-white/[0.06] p-3 sm:p-4 rounded-2xl flex flex-col justify-between shadow-lg">
              <span className="text-[10px] sm:text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                Faltantes (-)
              </span>
              <div className="my-1.5 text-xl sm:text-2xl font-semibold text-rose-400">
                {shortageCount}
              </div>
              <span className="text-[10px] text-rose-400 truncate">
                -${summary.totalShortageCost.toFixed(2)}
              </span>
            </div>

            <div className="bg-[#141522] border border-white/[0.06] p-3 sm:p-4 rounded-2xl flex flex-col justify-between shadow-lg">
              <span className="text-[10px] sm:text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Novedades
              </span>
              <div className="my-1.5 text-xl sm:text-2xl font-semibold text-amber-300">
                {summary.requiresRecountCount + summary.noveltiesTotal}
              </div>
              <span className="text-[10px] text-amber-400 truncate">
                {summary.requiresRecountCount} rec. • {summary.noveltiesTotal} físicas
              </span>
            </div>

            <div className="bg-[#141522] border border-white/[0.06] p-3 sm:p-4 rounded-2xl flex flex-col justify-between shadow-lg">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Impacto Neto
              </span>
              <div
                className={`my-1.5 text-xl sm:text-2xl font-semibold truncate ${
                  summary.netCostImpact === 0
                    ? 'text-white'
                    : summary.netCostImpact > 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {summary.netCostImpact >= 0 ? '+' : ''}${summary.netCostImpact.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500">Diferencia monetaria</span>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SECCIÓN 1 (PRIMERO): RESUMEN DE NOVEDADES (FALTANTES Y SOBRANTES) */}
          {/* ============================================================== */}
          <div className="no-print bg-[#141416] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[#A1A1AA] shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                    <span>1. Resumen Ejecutivo de Novedades (Faltantes y Sobrantes)</span>
                    <span className="text-xs px-2.5 py-0.5 rounded bg-white/[0.05] text-[#D4D4D8] font-mono font-medium border border-white/[0.08]">
                      {filteredDiscrepancyItems.length} {filteredDiscrepancyItems.length === 1 ? 'ítem' : 'ítems'}
                    </span>
                  </h2>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Faltantes, sobrantes y registros con inconsistencia física • 30 ítems por página
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Selector de Modo de Visualización: Tarjetas Móviles vs Tabla */}
                <div className="flex items-center gap-1 bg-[#111113] p-1 rounded-lg border border-white/[0.08] text-xs">
                  <button
                    type="button"
                    onClick={() => setMobileCardMode(true)}
                    className={`px-2.5 py-1 rounded-md font-medium text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                      mobileCardMode ? 'bg-white/10 text-white font-semibold' : 'text-[#71717A] hover:text-white'
                    }`}
                    title="Vista en Tarjetas"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Tarjetas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileCardMode(false)}
                    className={`px-2.5 py-1 rounded-md font-medium text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                      !mobileCardMode ? 'bg-white/10 text-white font-semibold' : 'text-[#71717A] hover:text-white'
                    }`}
                    title="Vista de Tabla Completa"
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Tabla</span>
                  </button>
                </div>

                {/* Controles rápidos de paginación superior */}
                {totalDiscrepancyPages > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      disabled={discrepancyPage <= 1}
                      onClick={() => setDiscrepancyPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      title="Página Anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-slate-300 font-bold px-2 py-1 rounded bg-slate-950 border border-slate-800">
                      {discrepancyPage} / {totalDiscrepancyPages}
                    </span>
                    <button
                      type="button"
                      disabled={discrepancyPage >= totalDiscrepancyPages}
                      onClick={() => setDiscrepancyPage((p) => Math.min(totalDiscrepancyPages, p + 1))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      title="Página Siguiente"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por Cód. Id, Descripción, Código de Barras o Ubicación..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="text-xs text-slate-400">
                  Mostrando{' '}
                  <strong className="text-white font-mono">
                    {filteredDiscrepancyItems.length > 0 ? (discrepancyPage - 1) * ITEMS_PER_PAGE + 1 : 0}
                  </strong>{' '}
                  -{' '}
                  <strong className="text-white font-mono">
                    {Math.min(discrepancyPage * ITEMS_PER_PAGE, filteredDiscrepancyItems.length)}
                  </strong>{' '}
                  de <strong className="text-white font-mono">{filteredDiscrepancyItems.length}</strong> discrepancias
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
                  Todas las Discrepancias ({discrepancyItems.length})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStatus('shortage')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'shortage'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-slate-800/60 text-rose-400 hover:text-white'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  Solo Faltantes ({shortageCount})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStatus('surplus')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'surplus'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-slate-800/60 text-cyan-400 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Solo Sobrantes ({surplusCount})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStatus('recount')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'recount'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-800/60 text-amber-400 hover:text-white'
                  }`}
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  Requiere Reconteo ({summary.requiresRecountCount})
                </button>
              </div>
            </div>

            {/* Contenedor de Novedades y Discrepancias: Tarjetas Móviles y Tabla Desktop */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
              {/* VISTA MÓVIL EN TARJETAS COMPACTAS (SIN SCROLL HORIZONTAL) */}
              {mobileCardMode && (
                <div className="md:hidden space-y-3 p-3">
                  {paginatedDiscrepancies.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2 opacity-80" />
                      <p className="font-semibold text-white text-xs">¡Sin discrepancias registradas!</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        No se encontraron faltantes, sobrantes ni novedades con los filtros aplicados.
                      </p>
                    </div>
                  ) : (
                    paginatedDiscrepancies.map((item, localIdx) => {
                      const globalIdx = (discrepancyPage - 1) * ITEMS_PER_PAGE + localIdx + 1;
                      const theoBreakdown = formatStockBreakdown(item.systemStock, item.packQuantity);
                      const physBreakdown = formatStockBreakdown(item.totalCounted, item.packQuantity);
                      const diffBreakdown = formatStockBreakdown(Math.abs(item.difference), item.packQuantity);
                      const isShort = item.difference < 0 || item.status === 'shortage';
                      const isSurp = item.difference > 0 || item.status === 'surplus';
                      const codId = (item as any).internalCode || item.sku;

                      return (
                        <div
                          key={`mob-disc-${item.id}`}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            item.requiresRecount
                              ? 'bg-amber-950/20 border-amber-500/40'
                              : isShort
                              ? 'bg-rose-950/20 border-rose-500/30'
                              : isSurp
                              ? 'bg-cyan-950/20 border-cyan-500/30'
                              : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          {/* Fila Superior: #, Estado, Impacto $ */}
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                                {globalIdx}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  isShort
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : isSurp
                                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {isShort ? 'Faltante' : isSurp ? 'Sobrante' : item.status}
                              </span>
                              {item.requiresRecount && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  Reconteo
                                </span>
                              )}
                              {item.hasNovelties && (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                  Novedad ({item.noveltiesCount})
                                </span>
                              )}
                            </div>

                            {/* Impacto Monetario */}
                            <div className="font-mono font-semibold text-xs shrink-0">
                              {item.costImpact === 0 ? (
                                <span className="text-slate-400">$0.00</span>
                              ) : item.costImpact > 0 ? (
                                <span className="text-cyan-400">+${item.costImpact.toFixed(2)}</span>
                              ) : (
                                <span className="text-rose-400">-${Math.abs(item.costImpact).toFixed(2)}</span>
                              )}
                            </div>
                          </div>

                          {/* Descripción y Metadatos */}
                          <div className="text-xs sm:text-sm font-bold text-white leading-snug">
                            {item.description}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 font-mono mt-1">
                            <span className="text-cyan-300 font-bold">Cód: {codId}</span>
                            {item.barcode && item.barcode !== codId && <span>• Bar: {item.barcode}</span>}
                            <span>• Factor: 1x{item.packQuantity}</span>
                            {item.location && <span>• Ubic: {item.location}</span>}
                            {item.batchNumber && <span>• Lote: {item.batchNumber}</span>}
                            {item.expirationDate && (
                              <span className="text-amber-400">
                                • Vto: {new Date(item.expirationDate).toLocaleDateString('es-ES')}
                              </span>
                            )}
                          </div>

                          {/* Grilla de Métricas Comparativas: 3 Columnas Claras */}
                          <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 mt-2 text-center">
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-500 block">Sistema</span>
                              <span className="font-mono font-bold text-white text-xs block truncate mt-0.5">
                                {theoBreakdown.formatted}
                              </span>
                              <span className="font-mono text-[9px] text-slate-500 block">
                                {item.systemStock} f
                              </span>
                            </div>

                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-500 block">Contado</span>
                              <span className="font-mono font-bold text-emerald-300 text-xs block truncate mt-0.5">
                                {item.status === 'uncounted' ? 'Sin conteo' : physBreakdown.formatted}
                              </span>
                              <span className="font-mono text-[9px] text-slate-500 block">
                                {item.status === 'uncounted' ? '---' : `${item.totalCounted} f`}
                              </span>
                            </div>

                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-500 block">Diferencia</span>
                              <span
                                className={`font-mono font-semibold text-xs block truncate mt-0.5 ${
                                  item.difference > 0 ? 'text-cyan-400' : item.difference < 0 ? 'text-rose-400' : 'text-emerald-400'
                                }`}
                              >
                                {item.difference > 0 ? '+' : item.difference < 0 ? '-' : ''}
                                {diffBreakdown.formatted}
                              </span>
                              <span className="font-mono text-[9px] text-slate-400 block">
                                {item.difference > 0 ? '+' : ''}{item.difference} f ({item.differencePercentage}%)
                              </span>
                            </div>
                          </div>

                          {/* Fila de Acciones y Fotos */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.05]">
                            <div className="flex items-center gap-1.5">
                              {item.imageUrl && (
                                <img
                                  src={item.imageUrl}
                                  alt="Foto"
                                  onClick={() => setViewImageModal({ url: item.imageUrl!, title: item.description })}
                                  className="w-7 h-7 object-cover rounded-lg border border-cyan-500/60 cursor-pointer shadow hover:opacity-80"
                                />
                              )}
                              {!isPublicView && (
                                <label className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 cursor-pointer">
                                  <Camera className="w-3.5 h-3.5" />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleUploadItemImage(item.id, f);
                                    }}
                                  />
                                </label>
                              )}
                              <button
                                type="button"
                                onClick={() => setActiveLabelItem(item)}
                                className="p-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 cursor-pointer"
                                title="Etiqueta"
                              >
                                <Tag className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="text-[10px] text-slate-400 font-mono">
                              Costo Unit: ${Number(item.unitCostCalculated || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TABLA COMPLETA TRADICIONAL (VISIBLE EN ESCRITORIO O AL DESACTIVAR TARJETAS) */}
              <div className={`${mobileCardMode ? 'hidden md:block' : 'block'} overflow-x-auto`}>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-3 text-center w-10">#</th>
                      <th className="px-4 py-3">Producto / SKU</th>
                      <th className="px-3 py-3 text-center">Foto / Etiqueta</th>
                      <th className="px-3 py-3 text-center">Factor</th>
                      <th className="px-4 py-3 text-right">Stock Teórico</th>
                      <th className="px-4 py-3 text-right">Físico Contado</th>
                      <th className="px-4 py-3 text-right">Diferencia</th>
                      <th className="px-4 py-3 text-right">Impacto $</th>
                      <th className="px-3 py-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {paginatedDiscrepancies.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                          <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2 opacity-80" />
                          <p className="font-semibold text-white">¡Sin discrepancias registradas!</p>
                          <p className="text-xs text-slate-400 mt-1">
                            No se encontraron faltantes, sobrantes ni novedades con los filtros aplicados.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginatedDiscrepancies.map((item, localIdx) => {
                        const globalIdx = (discrepancyPage - 1) * ITEMS_PER_PAGE + localIdx + 1;
                        const theoBreakdown = formatStockBreakdown(item.systemStock, item.packQuantity);
                        const physBreakdown = formatStockBreakdown(item.totalCounted, item.packQuantity);
                        const diffBreakdown = formatStockBreakdown(
                          Math.abs(item.difference),
                          item.packQuantity
                        );

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-slate-800/40 transition-colors ${
                              item.requiresRecount ? 'bg-amber-500/5' : ''
                            }`}
                          >
                            {/* Número Correlativo */}
                            <td className="px-3 py-3 text-center font-mono font-bold text-slate-500 text-[11px]">
                              {globalIdx}
                            </td>

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
                                  <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    Requiere Reconteo
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

                                {!isPublicView && (
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
                                )}

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
                            <td className="px-3 py-3 text-center font-mono text-cyan-400">
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
                                    {item.difference > 0 ? '+' : '-'}
                                    {diffBreakdown.formatted}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block font-normal">
                                    ({item.difference > 0 ? '+' : ''}
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
                            <td className="px-3 py-3 text-center">
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

            {/* Paginación Inferior de Sección 1 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-400">
                Página <strong className="text-white font-mono">{discrepancyPage}</strong> de{' '}
                <strong className="text-white font-mono">{totalDiscrepancyPages}</strong> (Bloques de 30 ítems)
              </div>

              {totalDiscrepancyPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={discrepancyPage <= 1}
                    onClick={() => setDiscrepancyPage((p) => Math.max(1, p - 1))}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Anterior</span>
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalDiscrepancyPages }, (_, i) => i + 1)
                      .slice(
                        Math.max(0, discrepancyPage - 3),
                        Math.min(totalDiscrepancyPages, discrepancyPage + 2)
                      )
                      .map((pg) => (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setDiscrepancyPage(pg)}
                          className={`w-8 h-8 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                            discrepancyPage === pg
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-800/80 text-slate-400 hover:text-white'
                          }`}
                        >
                          {pg}
                        </button>
                      ))}
                  </div>

                  <button
                    type="button"
                    disabled={discrepancyPage >= totalDiscrepancyPages}
                    onClick={() => setDiscrepancyPage((p) => Math.min(totalDiscrepancyPages, p + 1))}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* SECCIÓN 2 (DESPUÉS): DETALLE DE NOVEDADES E INCIDENCIAS         */}
          {/* ============================================================== */}
          <div className="no-print bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
                    <span>2. Detalle de Novedades e Incidencias con Imágenes y Notas</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                      {novelties ? novelties.length : 0} {novelties && novelties.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evidencia fotográfica ampliable, lote, vencimiento, cantidad física y notas del auditor
                  </p>
                </div>
              </div>
            </div>

            {(!novelties || novelties.length === 0) ? (
              <div className="p-8 text-center text-slate-400 bg-slate-950/60 rounded-2xl border border-slate-800">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-white text-sm">Sin Novedades Físicas Especiales</p>
                <p className="text-xs text-slate-400 mt-1">
                  No se registraron roturas, daños o alertas de lote durante esta sesión de conteo.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {novelties.map((nov, idx) => {
                  const matching = itemsList.find((x) => x.id === nov.itemId);
                  const sku = matching?.sku || 'N/A';
                  const description = matching?.description || nov.notes || 'Ítem con novedad';
                  const img = nov.imageUrl || matching?.imageUrl;

                  return (
                    <div
                      key={nov.id || idx}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 hover:border-amber-500/40 transition-all shadow-md"
                    >
                      {/* Evidencia Fotográfica */}
                      {img ? (
                        <div className="shrink-0 flex flex-col items-center justify-center">
                          <img
                            src={img}
                            alt="Evidencia fotográfica"
                            onClick={() => setViewImageModal({ url: img, title: `${sku} - ${description}` })}
                            className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-xl border border-amber-500/40 shadow cursor-pointer hover:opacity-90 transition-opacity"
                            title="Haz clic para ver la imagen en tamaño completo"
                          />
                          <span className="text-[10px] text-amber-400 font-medium mt-1 cursor-pointer">
                            Ver foto ampliada
                          </span>
                        </div>
                      ) : (
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-400 shrink-0 text-center p-2">
                          <Camera className="w-6 h-6 mb-1 opacity-40 text-slate-400" />
                          <span className="text-[10px] text-slate-400">Sin foto adjunta</span>
                        </div>
                      )}

                      {/* Datos del Ítem y Novedad */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <span className="font-mono text-[10px] text-amber-400 font-bold">
                            SKU: {sku}
                          </span>
                          <h3 className="text-sm font-bold text-white leading-tight mt-0.5 break-words">
                            {description}
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-medium">Lote:</span>
                            <span className="font-mono font-bold text-amber-300">
                              {nov.batchNumber || 'N/A'}
                            </span>
                          </div>

                          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-medium">Fecha:</span>
                            <span className="font-mono font-bold text-cyan-300">
                              {nov.expirationDate
                                ? new Date(nov.expirationDate).toLocaleDateString('es-ES')
                                : 'N/A'}
                            </span>
                          </div>

                          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-medium">Cantidad:</span>
                            <span className="font-mono font-bold text-emerald-400 text-sm">
                              {nov.quantity} u
                            </span>
                          </div>

                          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-medium">Tipo:</span>
                            <span className="font-semibold text-slate-200 capitalize truncate block">
                              {nov.noveltyType.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        {nov.notes && (
                          <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs">
                            <span className="text-[10px] text-amber-400 font-bold block mb-0.5">
                              Nota / Detalle:
                            </span>
                            <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                              {nov.notes}
                            </p>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                          <span>
                            Reportado por: <strong className="text-slate-300">{nov.reportedBy}</strong>
                          </span>
                          {nov.createdAt && (
                            <span>
                              {new Date(nov.createdAt).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* SECCIÓN 3 (DESPUÉS): CATÁLOGO DE ÍTEMS CONFORMES Y CONCILIADOS */}
          {/* ============================================================== */}
          <div className="no-print bg-slate-900 border border-emerald-500/30 rounded-3xl overflow-hidden shadow-xl">
            <button
              type="button"
              onClick={() => setShowCompliantSection(!showCompliantSection)}
              className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>3. Catálogo de Ítems Conformes y Conciliados (100% Exactitud)</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                      {compliantItems.length} conformes
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Productos cuyo conteo físico coincide exactamente con el stock teórico del sistema
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 shrink-0">
                <span>{showCompliantSection ? 'Ocultar Detalle' : 'Ver Detalle'}</span>
                {showCompliantSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showCompliantSection && (
              <div className="p-5 sm:p-6 border-t border-slate-800 space-y-4">
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
                  {/* VISTA MÓVIL (TARJETAS COMPACTAS CONFORMES) */}
                  {mobileCardMode && (
                    <div className="md:hidden space-y-2.5 p-3">
                      {paginatedCompliant.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs">
                          No hay productos conformes que coincidan con la búsqueda.
                        </div>
                      ) : (
                        paginatedCompliant.map((item, localIdx) => {
                          const globalIdx = (compliantPage - 1) * ITEMS_PER_PAGE + localIdx + 1;
                          const physBreakdown = formatStockBreakdown(item.totalCounted, item.packQuantity);

                          return (
                            <div
                              key={`mob-comp-${item.id}`}
                              className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/20 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[10px] text-slate-500 font-bold shrink-0">
                                    #{globalIdx}
                                  </span>
                                  <span className="font-bold text-white text-xs truncate">
                                    {item.description}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Cód: {(item as any).internalCode || item.sku} • Factor: 1x{item.packQuantity}
                                  {item.location && ` • Ubic: ${item.location}`}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-mono font-bold text-emerald-300 text-xs block">
                                  {physBreakdown.formatted}
                                </span>
                                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                                  Conforme ✓
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* TABLA ESCRITORIO O AL DESACTIVAR TARJETAS */}
                  <div className={`${mobileCardMode ? 'hidden md:block' : 'block'} overflow-x-auto`}>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-3 text-center w-10">#</th>
                          <th className="px-4 py-3">Producto / SKU</th>
                          <th className="px-3 py-3 text-center">Factor</th>
                          <th className="px-4 py-3 text-right">Stock Teórico</th>
                          <th className="px-4 py-3 text-right">Físico Contado</th>
                          <th className="px-4 py-3 text-right">Diferencia</th>
                          <th className="px-3 py-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {paginatedCompliant.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                              No hay productos conformes que coincidan con la búsqueda.
                            </td>
                          </tr>
                        ) : (
                          paginatedCompliant.map((item, localIdx) => {
                            const globalIdx = (compliantPage - 1) * ITEMS_PER_PAGE + localIdx + 1;
                            const theoBreakdown = formatStockBreakdown(item.systemStock, item.packQuantity);
                            const physBreakdown = formatStockBreakdown(item.totalCounted, item.packQuantity);

                            return (
                              <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-3 py-3 text-center font-mono font-bold text-slate-500 text-[11px]">
                                  {globalIdx}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-white text-xs">{item.description}</div>
                                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                    SKU: {item.sku} {item.location ? `• Ubic: ${item.location}` : ''}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center font-mono text-cyan-400">
                                  1x{item.packQuantity}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-white">
                                  {theoBreakdown.formatted}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-emerald-300">
                                  {physBreakdown.formatted}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                                  0 u (Exacto)
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Conforme
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

                {/* Paginación de Ítems Conformes */}
                {totalCompliantPages > 1 && (
                  <div className="flex items-center justify-between text-xs pt-2">
                    <span className="text-slate-400">
                      Página <strong className="text-white font-mono">{compliantPage}</strong> de{' '}
                      <strong className="text-white font-mono">{totalCompliantPages}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={compliantPage <= 1}
                        onClick={() => setCompliantPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        disabled={compliantPage >= totalCompliantPages}
                        onClick={() => setCompliantPage((p) => Math.min(totalCompliantPages, p + 1))}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                <h2 className="text-base font-semibold uppercase tracking-tight text-slate-900">
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
                <div className="flex justify-between text-sm font-semibold text-rose-700 pt-1">
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

              {/* Link Interactivo en Hoja 1 A6 */}
              {publicShareUrl && (
                <div className="pt-3 border-t border-dashed border-slate-300 flex items-center justify-between gap-2 text-left">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[8px] font-bold uppercase text-cyan-800 block">
                      🔗 Informe Detallado en Línea:
                    </span>
                    <a
                      href={publicShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[8px] font-mono text-blue-700 underline block truncate"
                    >
                      Abrir versión interactiva completa
                    </a>
                  </div>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=${encodeURIComponent(publicShareUrl)}`}
                    alt="QR"
                    className="w-11 h-11 border border-slate-200 rounded p-0.5 shrink-0"
                  />
                </div>
              )}
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
                <h2 className="text-base font-semibold uppercase tracking-tight text-slate-900">
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
                <div className="flex justify-between text-sm font-semibold text-emerald-700 pt-1">
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

              {/* Link Interactivo en Hoja 2 A6 */}
              {publicShareUrl && (
                <div className="pt-3 border-t border-dashed border-slate-300 flex items-center justify-between gap-2 text-left">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[8px] font-bold uppercase text-emerald-800 block">
                      🔗 Informe Detallado en Línea:
                    </span>
                    <a
                      href={publicShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[8px] font-mono text-blue-700 underline block truncate"
                    >
                      Abrir versión interactiva completa
                    </a>
                  </div>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=${encodeURIComponent(publicShareUrl)}`}
                    alt="QR"
                    className="w-11 h-11 border border-slate-200 rounded p-0.5 shrink-0"
                  />
                </div>
              )}
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
                <span className="text-2xl font-semibold text-amber-300 font-mono mt-1 block">
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
                <span className="text-2xl font-semibold text-rose-400 font-mono mt-1 block">
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
                <span className="text-2xl font-semibold text-emerald-400 font-mono mt-1 block">
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
                  placeholder="Buscar por Cód. Id, Descripción, Código de Barras o Lote..."
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
                                      locations: [],
                                      locationsCount: 0,
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
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Próximo a vencer (&lt; 3 meses) — Custodia
                              </span>
                            ) : p.status === 'expired' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                <AlertOctagon className="w-3.5 h-3.5" />
                                Producto Vencido
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Vigente
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
                  <div className="font-mono text-sm font-semibold text-slate-900 mt-0.5">
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
                <h3 className="font-semibold text-sm text-slate-900 leading-snug">
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
                    <div className="bg-rose-50 border border-rose-300 text-rose-800 text-[10px] font-semibold px-2.5 py-1.5 rounded text-center">
                      Producto vencido ({exp.toLocaleDateString('es-ES')}) — Retirar de anaquel
                    </div>
                  );
                }
                if (diffDays <= 90) {
                  return (
                    <div className="bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-semibold px-2.5 py-1.5 rounded text-center">
                      Custodia / Cuarentena (&lt; 3 meses — Vence: {exp.toLocaleDateString('es-ES')})
                    </div>
                  );
                }
                return (
                  <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-semibold px-2.5 py-1.5 rounded text-center">
                    Conforme (Vence: {exp.toLocaleDateString('es-ES')})
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
      {/* MODAL: GENERAR PDF CON LINK INTERACTIVO Y COMPARTIR EN LÍNEA   */}
      {/* ============================================================== */}
      {isShareModalOpen && publicShareUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 no-print">
          <div className="bg-[#121212] border border-[#2c2c2c] rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Informe en Línea & PDF Interactivo
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Esqueleto de datos en Supabase • Visuales en Vercel
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#1a1a1a] border border-[#2c2c2c] flex flex-col sm:flex-row items-center gap-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(publicShareUrl)}`}
                alt="QR del Informe"
                className="w-28 h-28 rounded-xl border-2 border-white p-1 bg-white shrink-0 shadow-md"
              />
              <div className="space-y-2 text-xs text-slate-300">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Acceso Directo sin Contraseña (Solo Lectura)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Cualquier persona que reciba el PDF o este enlace podrá consultar la versión detallada del informe de forma estática/interactiva sin poder modificar ni alterar ningún dato.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Enlace Público Verificado
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={publicShareUrl}
                  className="flex-1 px-3 py-2.5 bg-[#0a0a0a] border border-[#2c2c2c] rounded-xl text-cyan-300 font-mono text-[11px] focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-cyan-400" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <a
                href={publicShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-[#1e1e1e] hover:bg-[#282828] text-slate-200 border border-[#2e2e2e] font-bold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <ExternalLink className="w-4 h-4 text-cyan-400" />
                <span>Probar Link en Pestaña</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  setIsShareModalOpen(false);
                  setTimeout(() => {
                    window.print();
                  }, 250);
                }}
                className="py-2.5 px-4 rounded-lg bg-white hover:bg-[#E4E4E7] text-[#0C0C0E] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Generar PDF con Link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECCIÓN SOLO PARA IMPRESIÓN (TABLA DE NOVEDADES EN PDF)        */}
      {/* ============================================================== */}
      {reportView !== 'quick_a6' && novelties && novelties.length > 0 && (
        <div className="print-only mt-8 page-break">
          <div className="border-b-2 border-slate-900 pb-1 mb-3">
            <h2 className="text-sm font-semibold uppercase text-slate-900">
              DETALLE DE NOVEDADES E INCIDENCIAS FÍSICAS REPORTADAS ({novelties.length})
            </h2>
            <p className="text-[10px] text-slate-600">
              Registro con evidencia fotográfica, lote, vencimiento, cantidad y notas de auditoría
            </p>
          </div>

          <table className="w-full text-[10px] border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-200 text-slate-900 font-bold">
                <th className="border border-slate-400 p-1.5 text-center w-16">Foto</th>
                <th className="border border-slate-400 p-1.5 text-left">SKU / Producto</th>
                <th className="border border-slate-400 p-1.5 text-center">Lote</th>
                <th className="border border-slate-400 p-1.5 text-center">Fecha</th>
                <th className="border border-slate-400 p-1.5 text-right">Cantidad</th>
                <th className="border border-slate-400 p-1.5 text-left">Observaciones / Notas</th>
                <th className="border border-slate-400 p-1.5 text-left">Reportó</th>
              </tr>
            </thead>
            <tbody>
              {novelties.map((nov, idx) => {
                const matching = itemsList.find((x) => x.id === nov.itemId);
                const img = nov.imageUrl || matching?.imageUrl;

                return (
                  <tr key={idx} className="border-b border-slate-300">
                    <td className="border border-slate-400 p-1 text-center">
                      {img ? (
                        <img
                          src={img}
                          alt="Evidencia"
                          className="w-14 h-14 object-cover mx-auto rounded border border-slate-300"
                        />
                      ) : (
                        <span className="text-[9px] text-slate-500 italic">Sin foto</span>
                      )}
                    </td>
                    <td className="border border-slate-400 p-1.5 align-top">
                      <div className="font-mono font-bold text-slate-900">{matching?.sku || 'N/A'}</div>
                      <div className="font-semibold text-slate-800">{matching?.description || nov.notes}</div>
                    </td>
                    <td className="border border-slate-400 p-1.5 text-center font-mono font-bold align-top">
                      {nov.batchNumber || 'N/A'}
                    </td>
                    <td className="border border-slate-400 p-1.5 text-center font-mono align-top">
                      {nov.expirationDate
                        ? new Date(nov.expirationDate).toLocaleDateString('es-ES')
                        : 'N/A'}
                    </td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono font-bold text-slate-900 align-top">
                      {nov.quantity} u
                    </td>
                    <td className="border border-slate-400 p-1.5 text-slate-800 align-top">
                      {nov.notes || '—'}
                    </td>
                    <td className="border border-slate-400 p-1.5 text-slate-700 font-medium align-top">
                      {nov.reportedBy}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
