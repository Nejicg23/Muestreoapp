'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Smartphone,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  Package,
  Layers,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Printer,
  ChevronRight,
  Minus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  User,
  Database,
  Check,
  Hash,
  Upload,
  FileSpreadsheet,
  SlidersHorizontal,
  X,
  FileText,
  DollarSign,
  AlertOctagon,
  Camera,
  Image as ImageIcon,
  Calendar,
} from 'lucide-react';
import { compressAndConvertToBase64 } from '@/lib/image-helper';
import {
  QuickCountItemInput,
  submitQuickInventoryAudit,
  getItemsBySession,
} from '@/app/actions/quick-inventory';
import { formatStockBreakdown } from '@/lib/inventory-consolidator';
import {
  parseExcelBuffer,
  parseCSVText,
  ParsedInventoryItem,
} from '@/lib/inventory-importer';

interface SessionOption {
  id: string;
  title: string;
  status: string;
  createdAt: string | Date;
  itemCount?: number;
}

interface RawItem {
  id: string;
  sessionId?: string;
  sku: string;
  barcode: string | null;
  description: string;
  systemStock: string | number;
  packQuantity: number;
  rawCost: string | number;
  unitCostCalculated: string | number;
  location: string | null;
  batchNumber?: string | null;
  expirationDate?: string | Date | null;
  imageUrl?: string | null;
}

interface Props {
  sessions: SessionOption[];
  initialSessionId?: string;
  initialItems: RawItem[];
  currentUser?: {
    id: string;
    username: string;
    fullName: string;
    role: string;
  } | null;
}

interface ActiveDatabaseInfo {
  source: 'session' | 'file' | 'pasted';
  sessionId?: string;
  name: string;
  totalItems: number;
}

export default function QuickInventoryClient({
  sessions,
  initialSessionId,
  initialItems,
  currentUser,
}: Props) {
  // Estado de la base de datos activa
  const [activeDb, setActiveDb] = useState<ActiveDatabaseInfo | null>(() => {
    if (initialSessionId && initialItems.length > 0) {
      const s = sessions.find((item) => item.id === initialSessionId);
      return {
        source: 'session',
        sessionId: initialSessionId,
        name: s?.title || 'Sesión Seleccionada',
        totalItems: initialItems.length,
      };
    }
    if (sessions.length > 0 && initialItems.length > 0) {
      return {
        source: 'session',
        sessionId: sessions[0].id,
        name: sessions[0].title,
        totalItems: initialItems.length,
      };
    }
    return null;
  });

  // Catálogo completo de ítems de la base de datos activa
  const [dbItems, setDbItems] = useState<RawItem[]>(initialItems);

  // ETAPA DEL FLUJO SECUENCIAL:
  // 1 = Elegir los ítems a contar
  // 2 = Asignar las cantidades que el sistema despliega (Stock Teórico / ERP)
  // 3 = Contar las cantidades físicas reales en estantería
  const [countStage, setCountStage] = useState<1 | 2 | 3>(1);

  // Control del modal selector / cargador de Base de Datos
  const [showDbSelector, setShowDbSelector] = useState<boolean>(
    !initialSessionId && initialItems.length === 0
  );
  const [dbTab, setDbTab] = useState<'upload' | 'paste' | 'existing'>('existing');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [pastedData, setPastedData] = useState('');
  const [parsedPreviewItems, setParsedPreviewItems] = useState<ParsedInventoryItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  // Buscador para seleccionar ítems
  const [searchQuery, setSearchQuery] = useState('');

  // Ítems seleccionados por el operador para el conteo rápido
  const [selectedQueue, setSelectedQueue] = useState<QuickCountItemInput[]>([]);

  // Modal para agregar ítem manual no catalogado
  const [manualItemModal, setManualItemModal] = useState<{
    isOpen: boolean;
    sku: string;
    description: string;
    packQuantity: number;
    externalPacks: number;
    externalLoose: number;
    boxCost: number;
    location: string;
  } | null>(null);

  // Datos formales del operador y auditoría
  const [operatorName, setOperatorName] = useState(
    currentUser?.fullName || 'Operador Móvil'
  );
  const [auditDate, setAuditDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [auditReason, setAuditReason] = useState('Muestreo Cíclico / Conteo Rápido');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewImageModal, setViewImageModal] = useState<{ url: string; title: string } | null>(null);

  // Comprobante final una vez asentado
  const [completedVoucher, setCompletedVoucher] = useState<{
    sessionId: string;
    closedHash: string;
    summary: {
      totalItems: number;
      matchedCount: number;
      discrepantCount: number;
      totalTheoreticalFractions: number;
      totalPhysicalFractions: number;
      accuracyPercentage: number;
    };
  } | null>(null);

  // MANEJO DE ARCHIVOS SUBIDOS (EXCEL / CSV)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setParseError(null);

    try {
      const buffer = await file.arrayBuffer();
      let items: ParsedInventoryItem[] = [];

      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = new TextDecoder('utf-8').decode(buffer);
        items = parseCSVText(text);
      } else {
        items = parseExcelBuffer(buffer);
      }

      if (items.length === 0) {
        setParseError('No se encontraron filas legibles en el archivo.');
      } else {
        setParsedPreviewItems(items);
      }
    } catch (err: any) {
      setParseError('Error al leer el archivo: ' + (err.message || 'Formato no soportado'));
    }
  };

  // MANEJO DE TEXTO PEGADO
  const handleParsePastedText = () => {
    if (!pastedData.trim()) return;
    setParseError(null);
    try {
      const items = parseCSVText(pastedData);
      if (items.length === 0) {
        setParseError('No se encontraron columnas reconocidas en el texto.');
      } else {
        setParsedPreviewItems(items);
      }
    } catch (err: any) {
      setParseError('Error al interpretar texto: ' + err.message);
    }
  };

  // APLICAR BASE DE DATOS DESDE ARCHIVO O TEXTO PEGADO
  const handleApplyImportedDatabase = () => {
    if (parsedPreviewItems.length === 0) {
      alert('Primero carga un archivo o pega los datos para interpretarlos.');
      return;
    }

    const converted: RawItem[] = parsedPreviewItems.map((p, idx) => ({
      id: `imported-${Date.now()}-${idx}`,
      sku: p.sku,
      barcode: null,
      description: p.description,
      systemStock: p.calculatedStock,
      packQuantity: p.factor,
      rawCost: p.boxCost,
      unitCostCalculated: p.unitCostCalculated,
      location: 'Bodega Principal',
    }));

    setDbItems(converted);
    setActiveDb({
      source: dbTab === 'upload' ? 'file' : 'pasted',
      name: uploadedFileName || `Datos Pegados (${new Date().toLocaleTimeString('es-ES')})`,
      totalItems: converted.length,
    });
    setShowDbSelector(false);
    setParsedPreviewItems([]);
    setParseError(null);
  };

  // CARGAR BASE DE DATOS DESDE SESIÓN EXISTENTE
  const handleSelectExistingSession = async (session: SessionOption) => {
    setLoadingSessionId(session.id);
    try {
      const res = await getItemsBySession(session.id);
      if (res.success && res.items) {
        setDbItems(res.items);
        setActiveDb({
          source: 'session',
          sessionId: session.id,
          name: session.title,
          totalItems: res.items.length,
        });
        setShowDbSelector(false);
      } else {
        alert(res.error || 'Error al obtener ítems de la sesión.');
      }
    } catch (err: any) {
      alert(err.message || 'Error al cargar la base de datos seleccionada');
    } finally {
      setLoadingSessionId(null);
    }
  };

  // FILTRO DE BÚSQUEDA EN TIEMPO REAL
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || dbItems.length === 0) return [];
    const q = searchQuery.toLowerCase().trim();
    const alreadySelectedIds = new Set(selectedQueue.map((s) => s.originalItemId));

    return dbItems
      .filter((item) => {
        if (alreadySelectedIds.has(item.id)) return false;
        return (
          item.description.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.includes(q))
        );
      })
      .slice(0, 10);
  }, [dbItems, searchQuery, selectedQueue]);

  // AGREGAR ÍTEM A LA COLA
  const handleAddItemToQueue = (item: RawItem) => {
    const factor = Math.max(1, item.packQuantity || 1);
    const initialTheoretical = Number(item.systemStock) || 0;
    const initialBreakdown = formatStockBreakdown(initialTheoretical, factor);
    const rawCostNum = Number(item.rawCost) || 0;
    const unitCostNum = Number(item.unitCostCalculated) || (factor > 0 && rawCostNum > 0 ? rawCostNum / factor : 0);
    const calculatedBoxCost = rawCostNum > 0 ? rawCostNum : (unitCostNum * factor);

    const newItem: QuickCountItemInput = {
      originalItemId: item.id,
      sku: item.sku,
      barcode: item.barcode,
      description: item.description,
      packQuantity: factor,
      unitCost: unitCostNum,
      boxCost: calculatedBoxCost > 0 ? calculatedBoxCost : undefined,
      location: item.location,
      batchNumber: item.batchNumber || null,
      expirationDate: item.expirationDate
        ? (typeof item.expirationDate === 'string'
            ? item.expirationDate.split('T')[0]
            : new Date(item.expirationDate).toISOString().split('T')[0])
        : null,
      imageUrl: item.imageUrl || null,
      externalPacks: initialBreakdown.packs,
      externalLoose: factor <= 1 ? 0 : initialBreakdown.loose,
      countedPacks: 0,
      countedLoose: 0,
      hasNovelty: false,
    };

    setSelectedQueue((prev) => [...prev, newItem]);
    setSearchQuery('');
  };

  // AGREGAR ÍTEM MANUAL NO CATALOGADO
  const handleSaveManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualItemModal) return;
    if (!manualItemModal.sku.trim()) {
      alert('Ingresa el SKU o código del producto.');
      return;
    }
    if (!manualItemModal.description.trim()) {
      alert('Ingresa la descripción del producto.');
      return;
    }

    const factor = Math.max(1, manualItemModal.packQuantity || 1);
    const boxCost = Math.max(0, manualItemModal.boxCost || 0);
    const unitCost = factor > 0 ? boxCost / factor : 0;

    const newItem: QuickCountItemInput = {
      originalItemId: `manual-${Date.now()}`,
      sku: manualItemModal.sku.trim(),
      barcode: null,
      description: manualItemModal.description.trim(),
      packQuantity: factor,
      unitCost,
      location: manualItemModal.location || 'Bodega',
      externalPacks: Math.max(0, manualItemModal.externalPacks || 0),
      externalLoose: Math.max(0, manualItemModal.externalLoose || 0),
      countedPacks: 0,
      countedLoose: 0,
      hasNovelty: false,
    };

    setSelectedQueue((prev) => [...prev, newItem]);
    setManualItemModal(null);
  };

  // QUITAR ÍTEM DE LA COLA
  const handleRemoveFromQueue = (index: number) => {
    setSelectedQueue((prev) => prev.filter((_, i) => i !== index));
  };

  // ACTUALIZAR VALORES DE UN ÍTEM EN LA COLA
  const handleUpdateQueueItem = (
    index: number,
    field: keyof QuickCountItemInput,
    value: any
  ) => {
    setSelectedQueue((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // ASENTAR FORMALMENTE EL INVENTARIO RÁPIDO
  const handleSubmitQuickAudit = async () => {
    if (selectedQueue.length === 0) {
      alert('Debes agregar al menos un ítem para realizar el inventario rápido.');
      return;
    }
    if (!operatorName.trim()) {
      alert('Debes ingresar el nombre del operador responsable.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitQuickInventoryAudit({
        sourceSessionId: activeDb?.sessionId,
        operatorName,
        auditDate,
        reason: auditReason,
        items: selectedQueue,
      });

      if (res.success && res.sessionId && res.closedHash && res.summary) {
        setCompletedVoucher({
          sessionId: res.sessionId,
          closedHash: res.closedHash,
          summary: res.summary,
        });
      } else {
        alert(res.error || 'Error al asentar inventario rápido');
      }
    } catch (err: any) {
      alert(err.message || 'Error de comunicación');
    } finally {
      setIsSubmitting(false);
    }
  };

  // VOUCHER / COMPROBANTE FINAL
  if (completedVoucher) {
    return (
      <div className="max-w-xl mx-auto space-y-6 pb-20">
        <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Conteo Rápido Asentado & Certificado
            </span>
            <h1 className="text-2xl font-black text-white mt-2">
              Comprobante Formal de Inventario
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Operador: <strong className="text-slate-200">{operatorName}</strong> • {new Date().toLocaleString('es-ES')}
            </p>
          </div>

          {/* Sello SHA-256 */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-left space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 font-semibold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                Sello Criptográfico Legal (SHA-256)
              </span>
              <span className="font-mono text-[9px]">Inmutable</span>
            </div>
            <div className="font-mono text-[10px] text-slate-300 break-all select-all">
              {completedVoucher.closedHash}
            </div>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Ítems Auditados</span>
              <span className="text-xl font-black text-white font-mono mt-0.5 block">
                {completedVoucher.summary.totalItems}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-emerald-400 block uppercase font-medium">Exactos (OK)</span>
              <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">
                {completedVoucher.summary.matchedCount}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-rose-400 block uppercase font-medium">Diferencias</span>
              <span className="text-xl font-black text-rose-400 font-mono mt-0.5 block">
                {completedVoucher.summary.discrepantCount}
              </span>
            </div>
          </div>

          {/* Acciones */}
          <div className="space-y-2 pt-2">
            <Link
              href={`/sesion/${completedVoucher.sessionId}/reporte`}
              className="w-full py-3.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-600/25"
            >
              <span>Ver Reporte Consolidado y Exportar Excel</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={() => {
                setCompletedVoucher(null);
                setSelectedQueue([]);
                setCountStage(1);
              }}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Realizar Otro Inventario Rápido</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      {/* Encabezado Material Dark */}
      <div className="bg-gradient-to-r from-[#121212] via-[#1a1a1a] to-[#121212] p-4 sm:p-6 rounded-3xl border border-[#2c2c2c] shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Inventario Rápido
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Flujo de 3 Pasos
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                1. Elige los ítems ➔ 2. Asigna stock del sistema ➔ 3. Cuenta físicamente.
              </p>
            </div>
          </div>
        </div>

        {/* STEPPER DE LAS 3 ETAPAS */}
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setCountStage(1)}
            className={`p-2.5 rounded-2xl border text-left transition-all ${
              countStage === 1
                ? 'bg-cyan-500/20 border-cyan-500/50 text-white shadow-md shadow-cyan-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span className="text-[9px] font-mono font-bold uppercase block text-cyan-400">Paso 1</span>
            <span className="text-xs font-bold block truncate mt-0.5">1. Elegir Ítems</span>
          </button>

          <button
            type="button"
            disabled={selectedQueue.length === 0}
            onClick={() => setCountStage(2)}
            className={`p-2.5 rounded-2xl border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              countStage === 2
                ? 'bg-cyan-500/20 border-cyan-500/50 text-white shadow-md shadow-cyan-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span className="text-[9px] font-mono font-bold uppercase block text-cyan-400">Paso 2</span>
            <span className="text-xs font-bold block truncate mt-0.5">2. Stock Sistema</span>
          </button>

          <button
            type="button"
            disabled={selectedQueue.length === 0}
            onClick={() => setCountStage(3)}
            className={`p-2.5 rounded-2xl border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              countStage === 3
                ? 'bg-cyan-500/20 border-cyan-500/50 text-white shadow-md shadow-cyan-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span className="text-[9px] font-mono font-bold uppercase block text-cyan-400">Paso 3</span>
            <span className="text-xs font-bold block truncate mt-0.5">3. Conteo Físico</span>
          </button>
        </div>
      </div>

      {/* BANNER DE BASE DE DATOS ACTIVA */}
      {activeDb && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Database className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <span className="font-bold text-white block truncate">{activeDb.name}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {dbItems.length} productos en catálogo
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDbSelector(true)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold shrink-0 border border-slate-700"
          >
            Cambiar Base
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 1: ELEGIR LOS ÍTEMS A CONTAR                                         */}
      {/* ========================================================================= */}
      {countStage === 1 && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center border border-cyan-500/30">
                  1
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white">Elegir Ítems a Contar</h2>
                  <p className="text-[11px] text-slate-400">
                    Busca y selecciona los 5, 10 o más productos que auditarás en esta ronda.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setManualItemModal({
                    isOpen: true,
                    sku: `MAN-${Date.now().toString().slice(-4)}`,
                    description: '',
                    packQuantity: 1,
                    externalPacks: 0,
                    externalLoose: 0,
                    boxCost: 0,
                    location: 'Bodega Principal',
                  })
                }
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold border border-slate-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Manual</span>
              </button>
            </div>

            {/* Input de Búsqueda */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre (ej: Copin, Abanix) o SKU..."
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Coincidencias de Búsqueda */}
            {searchResults.length > 0 && (
              <div className="space-y-1.5 p-2 bg-slate-950/95 rounded-2xl border border-slate-800 max-h-72 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400">
                  Resultados encontrados ({searchResults.length})
                </div>
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-900 hover:bg-cyan-950/30 border border-slate-800/80 hover:border-cyan-500/40 transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-white block truncate">{item.description}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        SKU: {item.sku} • Factor: 1x{item.packQuantity}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddItemToQueue(item)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 shadow-md shadow-cyan-600/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Seleccionar</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Botones de muestra rápida si la cola está vacía */}
            {selectedQueue.length === 0 && dbItems.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
                <Package className="w-7 h-7 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-400">
                  Escribe arriba el nombre de cualquier producto o selecciona una muestra rápida:
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      dbItems.slice(0, 5).forEach((i) => handleAddItemToQueue(i));
                    }}
                    className="text-xs font-bold text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/40 px-3 py-1.5 rounded-xl border border-cyan-800/40"
                  >
                    Elegir primeros 5
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dbItems.slice(0, 10).forEach((i) => handleAddItemToQueue(i));
                    }}
                    className="text-xs font-bold text-indigo-400 bg-indigo-950/40 hover:bg-indigo-900/40 px-3 py-1.5 rounded-xl border border-indigo-800/40"
                  >
                    Elegir primeros 10
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* LISTA DE ÍTEMS SELECCIONADOS EN PASO 1 */}
          {selectedQueue.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-cyan-400" />
                  <span>Ítems Seleccionados para esta Auditoría ({selectedQueue.length})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedQueue([])}
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  Limpiar lista
                </button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {selectedQueue.map((item, idx) => (
                  <div
                    key={`${item.originalItemId}-${idx}`}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-white block truncate">{item.description}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        SKU: {item.sku} • Factor: 1x{item.packQuantity}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFromQueue(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400"
                      title="Eliminar de la lista"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Botón de Avance al Paso 2 */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setCountStage(2)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
                >
                  <span>Continuar al Paso 2: Asignar Stock del Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 2: ASIGNAR LAS CANTIDADES QUE EL SISTEMA DESPLIEGA (ERP / WMS)       */}
      {/* ========================================================================= */}
      {countStage === 2 && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center border border-cyan-500/30">
                  2
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Asignar Stock que Despliega el Sistema
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Ingresa lo que tu sistema externo (ERP, POS o pantalla) dice que debe haber en Cajas (u) y Fracciones (f).
                  </p>
                </div>
              </div>
              <span className="text-xs text-cyan-400 font-mono font-bold">
                {selectedQueue.length} ítems
              </span>
            </div>

            {/* Listado de Ítems para Ingresar Stock del Sistema */}
            <div className="space-y-3">
              {selectedQueue.map((item, index) => {
                const factor = Math.max(1, item.packQuantity || 1);
                const theoreticalTotal = (item.externalPacks * factor) + item.externalLoose;

                return (
                  <div
                    key={`${item.originalItemId}-${index}`}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-cyan-400 font-bold">
                          SKU: {item.sku} • Factor: 1x{factor}
                        </span>
                        <h3 className="text-xs font-bold text-white mt-0.5 truncate">
                          {item.description}
                        </h3>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0 font-bold">
                        Total: {theoreticalTotal} fracc.
                      </span>
                    </div>

                    {/* Inputs de Cajas y Fracciones de Sistema */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Cajas (u) */}
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">
                          Cajas en Sistema (u)
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQueueItem(
                                index,
                                'externalPacks',
                                Math.max(0, item.externalPacks - 1)
                              )
                            }
                            className="w-8 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.externalPacks}
                            onChange={(e) =>
                              handleUpdateQueueItem(
                                index,
                                'externalPacks',
                                Math.max(0, parseInt(e.target.value) || 0)
                              )
                            }
                            className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-center outline-none focus:border-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQueueItem(
                                index,
                                'externalPacks',
                                item.externalPacks + 1
                              )
                            }
                            className="w-8 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Fracciones (f) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-slate-400 block">
                            Fracciones en Sistema (f)
                          </label>
                          {factor <= 1 && (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                              No fracciona (1x1)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={factor <= 1}
                            onClick={() =>
                              handleUpdateQueueItem(
                                index,
                                'externalLoose',
                                Math.max(0, item.externalLoose - 1)
                              )
                            }
                            className="w-8 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 font-bold flex items-center justify-center shrink-0"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            disabled={factor <= 1}
                            value={factor <= 1 ? 0 : item.externalLoose}
                            onChange={(e) =>
                              handleUpdateQueueItem(
                                index,
                                'externalLoose',
                                Math.max(0, parseInt(e.target.value) || 0)
                              )
                            }
                            className="w-full px-2 py-2 bg-slate-900 border border-slate-700 disabled:bg-slate-950/60 disabled:text-slate-500 rounded-xl text-white font-mono font-bold text-center outline-none focus:border-cyan-500"
                          />
                          <button
                            type="button"
                            disabled={factor <= 1}
                            onClick={() =>
                              handleUpdateQueueItem(
                                index,
                                'externalLoose',
                                item.externalLoose + 1
                              )
                            }
                            className="w-8 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 font-bold flex items-center justify-center shrink-0"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Asignación o Edición del Valor de la Caja / Fracción */}
                    <div className="pt-2 border-t border-slate-800/80">
                      {(!item.unitCost || item.unitCost <= 0) ? (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <span className="text-amber-300 flex items-center gap-1.5 font-medium">
                            <DollarSign className="w-4 h-4 shrink-0 text-amber-400" />
                            Sin valor monetario asignado. Ingresa el costo de la caja para calcular impacto:
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                            <span className="text-slate-400 font-bold">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Costo Caja ($)"
                              value={item.boxCost || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const uCost = factor > 0 ? val / factor : val;
                                handleUpdateQueueItem(index, 'boxCost', val);
                                handleUpdateQueueItem(index, 'unitCost', uCost);
                              }}
                              className="w-28 px-2.5 py-1 bg-slate-900 border border-amber-500/50 rounded-lg text-white font-mono text-xs font-bold outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-800">
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                            Valor Caja: <strong className="text-white">${((item.boxCost || item.unitCost * factor)).toFixed(2)}</strong> (Unitario: ${item.unitCost.toFixed(4)})
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Modificar $:</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.boxCost || (item.unitCost * factor).toFixed(2)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const uCost = factor > 0 ? val / factor : val;
                                handleUpdateQueueItem(index, 'boxCost', val);
                                handleUpdateQueueItem(index, 'unitCost', uCost);
                              }}
                              className="w-20 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-white font-mono text-[11px] outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navegación entre Paso 1 y Paso 3 */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCountStage(1)}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a Elegir Ítems</span>
              </button>

              <button
                type="button"
                onClick={() => setCountStage(3)}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
              >
                <span>Continuar al Paso 3: Conteo Físico Real</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 3: CONTAR LAS CANTIDADES FÍSICAS REALES                               */}
      {/* ========================================================================= */}
      {countStage === 3 && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                  3
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white">Conteo Físico Real en Estantería</h2>
                  <p className="text-[11px] text-slate-400">
                    Cuenta físicamente lo que hay en anaquel. El sistema calculará la diferencia contra el Paso 2.
                  </p>
                </div>
              </div>
              <span className="text-xs text-emerald-400 font-mono font-bold">
                {selectedQueue.length} ítems
              </span>
            </div>

            {/* Listado de Ítems para Conteo Físico y Comparación */}
            <div className="space-y-3">
              {selectedQueue.map((item, index) => {
                const factor = Math.max(1, item.packQuantity || 1);
                const theoreticalTotal = (item.externalPacks * factor) + item.externalLoose;
                const physicalTotal = (item.countedPacks * factor) + item.countedLoose;
                const diff = physicalTotal - theoreticalTotal;

                return (
                  <div
                    key={`${item.originalItemId}-${index}`}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-slate-400">
                          SKU: {item.sku} • Factor: 1x{factor}
                        </span>
                        <h3 className="text-xs font-bold text-white mt-0.5 truncate">
                          {item.description}
                        </h3>
                      </div>
                      {/* Chip del stock del sistema del Paso 2 */}
                      <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded-lg text-cyan-300 border border-slate-800 font-mono shrink-0">
                        Sistema: {item.externalPacks}u {item.externalLoose}f ({theoreticalTotal})
                      </span>
                    </div>

                    {/* Inputs de Conteo Físico Real */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Cajas Físicas (u) */}
                      <div>
                        <label className="text-[10px] text-emerald-400 block mb-1 font-semibold">
                          Cajas Físicas Contadas (u)
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQueueItem(
                                index,
                                'countedPacks',
                                Math.max(0, item.countedPacks - 1)
                              )
                            }
                            className="w-8 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.countedPacks}
                            onChange={(e) =>
                              handleUpdateQueueItem(
                                index,
                                'countedPacks',
                                Math.max(0, parseInt(e.target.value) || 0)
                              )
                            }
                            className="w-full px-2 py-2 bg-slate-900 border border-emerald-500/40 rounded-xl text-white font-mono font-bold text-center outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQueueItem(
                                index,
                                'countedPacks',
                                item.countedPacks + 1
                              )
                            }
                            className="w-8 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center shrink-0"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Fracciones Físicas (f) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-emerald-400 block font-semibold">
                            Fracciones Físicas Contadas (f)
                          </label>
                          {factor <= 1 && (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                              No fracciona (1x1)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={factor <= 1}
                            onClick={() =>
                              handleUpdateQueueItem(
                                index,
                                'countedLoose',
                                Math.max(0, item.countedLoose - 1)
                              )
                            }
                            className="w-8 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 font-bold flex items-center justify-center shrink-0"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            disabled={factor <= 1}
                            value={factor <= 1 ? 0 : item.countedLoose}
                            onChange={(e) =>
                              handleUpdateQueueItem(
                                index,
                                'countedLoose',
                                Math.max(0, parseInt(e.target.value) || 0)
                              )
                            }
                            className="w-full px-2 py-2 bg-slate-900 border border-emerald-500/40 disabled:bg-slate-950/60 disabled:text-slate-500 rounded-xl text-white font-mono font-bold text-center outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            disabled={factor <= 1}
                            onClick={() =>
                              handleUpdateQueueItem(
                                index,
                                'countedLoose',
                                item.countedLoose + 1
                              )
                            }
                            className="w-8 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 font-bold flex items-center justify-center shrink-0"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Valor del Producto y Cuantificación del Impacto Monetario */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-2">
                      {(!item.unitCost || item.unitCost <= 0) ? (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <span className="text-amber-300 flex items-center gap-1.5 font-medium">
                            <DollarSign className="w-4 h-4 shrink-0 text-amber-400" />
                            Sin valor asignado. Añade el costo caja para cuantificar el impacto monetario:
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                            <span className="text-slate-400 font-bold">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Costo Caja ($)"
                              value={item.boxCost || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const uCost = factor > 0 ? val / factor : val;
                                handleUpdateQueueItem(index, 'boxCost', val);
                                handleUpdateQueueItem(index, 'unitCost', uCost);
                              }}
                              className="w-28 px-2.5 py-1 bg-slate-900 border border-amber-500/50 rounded-lg text-white font-mono text-xs font-bold outline-none focus:ring-1 focus:ring-amber-400"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-800">
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                            Valor Caja: <strong className="text-white">${((item.boxCost || item.unitCost * factor)).toFixed(2)}</strong> (Unitario: ${item.unitCost.toFixed(4)})
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Modificar $:</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.boxCost || (item.unitCost * factor).toFixed(2)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const uCost = factor > 0 ? val / factor : val;
                                handleUpdateQueueItem(index, 'boxCost', val);
                                handleUpdateQueueItem(index, 'unitCost', uCost);
                              }}
                              className="w-20 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-white font-mono text-[11px] outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>
                      )}

                      {/* Comparación Inmediata de Diferencias con Cuantificación Monetaria */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        {(() => {
                          const unitCostSafe = item.unitCost || 0;
                          const impactUSD = diff * unitCostSafe;

                          return (
                            <div className="flex items-center gap-2">
                              {diff === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                                  <Check className="w-3 h-3" />
                                  Exacto (0 fracc. • $0.00 USD)
                                </span>
                              ) : diff > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                                  <TrendingUp className="w-3 h-3" />
                                  Sobrante (+{diff} fracc. • +${impactUSD.toFixed(2)} USD)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
                                  <TrendingDown className="w-3 h-3" />
                                  Faltante ({diff} fracc. • -${Math.abs(impactUSD).toFixed(2)} USD)
                                </span>
                              )}
                            </div>
                          );
                        })()}

                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQueueItem(index, 'hasNovelty', !item.hasNovelty)
                          }
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                            item.hasNovelty
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                          }`}
                        >
                          {item.hasNovelty ? 'Novedad Activa' : '+ Novedad'}
                        </button>
                      </div>

                      {/* Captura de Fecha de Vencimiento y Lote (Opcional) con Atajos Rápidos */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            Lote / Batch (opcional)
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: L-48920"
                            value={item.batchNumber || ''}
                            onChange={(e) => handleUpdateQueueItem(index, 'batchNumber', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] text-slate-400 block">
                              Fecha de Vencimiento (opcional)
                            </label>
                            {/* Atajos Rápidos de Fechas */}
                            <div className="flex items-center gap-1">
                              {[
                                { label: '+3M', m: 3 },
                                { label: '+6M', m: 6 },
                                { label: '+1A', m: 12 },
                                { label: '+2A', m: 24 },
                              ].map((shortcut) => (
                                <button
                                  key={shortcut.label}
                                  type="button"
                                  onClick={() => {
                                    const d = new Date();
                                    d.setMonth(d.getMonth() + shortcut.m);
                                    handleUpdateQueueItem(index, 'expirationDate', d.toISOString().split('T')[0]);
                                  }}
                                  className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 hover:bg-cyan-900 text-cyan-300 border border-slate-700"
                                  title={`Asignar ${shortcut.m} meses desde hoy`}
                                >
                                  {shortcut.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <input
                            type="date"
                            value={item.expirationDate || ''}
                            onChange={(e) => handleUpdateQueueItem(index, 'expirationDate', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>

                      {/* Captura de Imagen / Evidencia Fotográfica o Etiqueta (Móvil y PC) */}
                      <div className="pt-2 border-t border-slate-800/60 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5 text-cyan-400" />
                            Registro Fotográfico / Foto de Etiqueta o Daño
                          </span>
                          {item.imageUrl && (
                            <button
                              type="button"
                              onClick={() => handleUpdateQueueItem(index, 'imageUrl', null)}
                              className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                            >
                              Eliminar foto
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1.5">
                          {item.imageUrl && (
                            <div className="flex items-center gap-2">
                              <img
                                src={item.imageUrl}
                                alt="Evidencia"
                                onClick={() =>
                                  setViewImageModal({
                                    url: item.imageUrl!,
                                    title: item.description,
                                  })
                                }
                                className="w-12 h-12 object-cover rounded-xl border border-cyan-500/50 cursor-pointer shadow-md hover:opacity-80 transition-opacity"
                                title="Haz clic para ampliar"
                              />
                              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Foto registrada
                              </span>
                            </div>
                          )}

                          <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-colors">
                            <Camera className="w-3.5 h-3.5" />
                            <span>{item.imageUrl ? 'Cambiar Foto' : 'Tomar Foto / Subir Imagen'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const base64 = await compressAndConvertToBase64(file);
                                    handleUpdateQueueItem(index, 'imageUrl', base64);
                                  } catch (err: any) {
                                    alert('Error al procesar la imagen: ' + err.message);
                                  }
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Alerta de Cuarentena / Próximo a Vencer (< 3 meses) */}
                      {item.expirationDate && (() => {
                        const exp = new Date(item.expirationDate);
                        const diffDays = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        if (diffDays <= 0) {
                          return (
                            <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5">
                              <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
                              <span>🔴 PRODUCTO VENCIDO (Venció hace {Math.abs(diffDays)} días)</span>
                            </div>
                          );
                        }
                        if (diffDays <= 90) {
                          return (
                            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-2 animate-pulse">
                              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                              <span>⚠️ PRÓXIMO A VENCER ({diffDays} DÍAS / &lt; 3 MESES) - MARCAR PARA CUSTODIA O CUARENTENA</span>
                            </div>
                          );
                        }
                        return (
                          <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                            <span>🟢 Vigente ({diffDays} días restantes)</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Novedades si está activa */}
                    {item.hasNovelty && (
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-300 text-[11px]">Tipo de Novedad</span>
                          <select
                            value={item.noveltyType || 'mal_estado'}
                            onChange={(e) =>
                              handleUpdateQueueItem(index, 'noveltyType', e.target.value)
                            }
                            className="bg-slate-900 border border-amber-500/40 text-amber-200 text-xs rounded-lg px-2 py-1"
                          >
                            <option value="mal_estado">Avería / Daño</option>
                            <option value="cruce_mercancia">Cruce de Mercancía</option>
                            <option value="vencimiento">Próxima a Vencer</option>
                            <option value="otro">Otro</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          placeholder="Detalle o nota (ej: empaque roto)..."
                          value={item.noveltyNotes || ''}
                          onChange={(e) =>
                            handleUpdateQueueItem(index, 'noveltyNotes', e.target.value)
                          }
                          className="w-full px-2.5 py-1 bg-slate-950 border border-amber-500/30 rounded-lg text-white text-xs outline-none"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ASENTAMIENTO Y FIRMA FORMAL */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 pt-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                Formalización y Sello Legal
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Operador Responsable
                  </label>
                  <input
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Fecha de Conteo / Auditoría
                  </label>
                  <input
                    type="date"
                    value={auditDate}
                    onChange={(e) => setAuditDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Motivo del Muestreo
                  </label>
                  <input
                    type="text"
                    value={auditReason}
                    onChange={(e) => setAuditReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCountStage(2)}
                  className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a Paso 2</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || selectedQueue.length === 0}
                  onClick={handleSubmitQuickAudit}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Selleando...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Finalizar & Sellar Inventario Rápido</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CAMBIAR / CARGAR BASE DE DATOS */}
      {showDbSelector && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
            {activeDb && (
              <button
                type="button"
                onClick={() => setShowDbSelector(false)}
                className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div>
              <h2 className="text-base font-bold text-white">Base de Datos para el Conteo</h2>
              <p className="text-xs text-slate-400">
                Selecciona una base de datos existente o sube un archivo nuevo para el inventario.
              </p>
            </div>

            {/* Pestañas */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDbTab('existing')}
                className={`py-2 rounded-xl transition-all ${
                  dbTab === 'existing' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Existentes ({sessions.length})
              </button>
              <button
                type="button"
                onClick={() => setDbTab('upload')}
                className={`py-2 rounded-xl transition-all ${
                  dbTab === 'upload' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Subir Excel
              </button>
              <button
                type="button"
                onClick={() => setDbTab('paste')}
                className={`py-2 rounded-xl transition-all ${
                  dbTab === 'paste' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Pegar Filas
              </button>
            </div>

            {dbTab === 'existing' && (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">
                    No hay bases previas. Sube un archivo Excel en la otra pestaña.
                  </p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-white block truncate">{s.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {s.itemCount ? `${s.itemCount} productos` : 'Catálogo'}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={loadingSessionId === s.id}
                        onClick={() => handleSelectExistingSession(s)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] shrink-0"
                      >
                        {loadingSessionId === s.id ? 'Cargando...' : 'Seleccionar'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {dbTab === 'upload' && (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-2xl p-5 text-center cursor-pointer relative bg-slate-950/60">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-7 h-7 text-cyan-400 mx-auto mb-1.5" />
                  <span className="text-xs font-bold text-white block">
                    {uploadedFileName || 'Arrastrar o seleccionar archivo Excel (.xlsx / .csv)'}
                  </span>
                </div>
                {parsedPreviewItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyImportedDatabase}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-600/30"
                  >
                    Usar {parsedPreviewItems.length} Productos
                  </button>
                )}
              </div>
            )}

            {dbTab === 'paste' && (
              <div className="space-y-2">
                <textarea
                  placeholder="Pega las filas copiadas de Excel..."
                  value={pastedData}
                  onChange={(e) => setPastedData(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  className="w-full py-2 rounded-xl bg-slate-800 text-cyan-400 text-xs font-bold"
                >
                  Interpretar
                </button>
                {parsedPreviewItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyImportedDatabase}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-600/30"
                  >
                    Usar {parsedPreviewItems.length} Productos
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL ÍTEM MANUAL */}
      {manualItemModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveManualItem}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl relative"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Agregar Ítem Manual</h2>
              <button
                type="button"
                onClick={() => setManualItemModal(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">SKU / Código</label>
                  <input
                    type="text"
                    value={manualItemModal.sku}
                    onChange={(e) =>
                      setManualItemModal({ ...manualItemModal, sku: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Factor (1xN)</label>
                  <input
                    type="number"
                    min="1"
                    value={manualItemModal.packQuantity}
                    onChange={(e) =>
                      setManualItemModal({
                        ...manualItemModal,
                        packQuantity: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Descripción del Producto</label>
                <input
                  type="text"
                  value={manualItemModal.description}
                  onChange={(e) =>
                    setManualItemModal({ ...manualItemModal, description: e.target.value })
                  }
                  required
                  placeholder="Ej: Paracetamol 500mg Tab x20"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none"
                />
              </div>

              {/* Cantidades que despliega el sistema para el ítem manual */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
                  Stock que Despliega el Sistema
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Cajas (u)</label>
                    <input
                      type="number"
                      min="0"
                      value={manualItemModal.externalPacks}
                      onChange={(e) =>
                        setManualItemModal({
                          ...manualItemModal,
                          externalPacks: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-center outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Fracciones (f)</label>
                    <input
                      type="number"
                      min="0"
                      value={manualItemModal.externalLoose}
                      onChange={(e) =>
                        setManualItemModal({
                          ...manualItemModal,
                          externalLoose: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-center outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setManualItemModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                Agregar a Selección
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VISOR DE FOTO / EVIDENCIA */}
      {viewImageModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-4 space-y-3 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white truncate max-w-[280px]">
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
            <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[70vh]">
              <img
                src={viewImageModal.url}
                alt={viewImageModal.title}
                className="w-full h-auto object-contain max-h-[70vh]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
