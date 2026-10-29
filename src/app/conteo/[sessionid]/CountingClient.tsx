'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Barcode,
  Search,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  ArrowLeft,
  Plus,
  Minus,
  Sparkles,
  ClipboardCheck,
  FileSpreadsheet,
  AlertOctagon,
  Clock,
  User,
  MapPin,
  X,
  Shield,
  Calculator,
  ShieldAlert,
  DollarSign,
  History,
  FileWarning,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { compressAndConvertToBase64 } from '@/lib/image-helper';
import { useInventorySync } from '@/hooks/useInventorySync';
import { calculateBreakdown, formatStockBreakdown } from '@/lib/inventory-consolidator';
import {
  recordDirectCount,
  recordDirectNovelty,
  recordOperatorNovelty,
  executeAuditorRecount,
  updateItemCostEstimate,
  toggleItemRecountFlag,
} from './actions';
import { logSearchAudit } from '@/app/actions/sync';

// Audio feedback usando Web Audio API sin dependencias externas
function playFeedbackSound(type: 'success' | 'alert') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {
    // Silently continue if audio policy blocks autoplay
  }
}

interface ItemData {
  id: string;
  sessionId: string;
  sku: string;
  barcode: string | null;
  description: string;
  systemStock: string | number;
  packQuantity: number;
  costBasis: string;
  rawCost: string | number;
  unitCostCalculated: string | number;
  location: string | null;
  requiresRecount: boolean;
}

interface CountData {
  id: string;
  itemId: string;
  inputQuantity: string | number;
  inputUnit: string;
  countedPacks: number;
  countedLoose: string | number;
  countedQuantity: string | number;
  locationScanned: string | null;
  countedBy: string;
  countedAt: Date | string;
  isRecount: boolean;
}

interface Props {
  session: {
    id: string;
    title: string;
    status: string;
    createdBy: string;
  };
  initialItems: ItemData[];
  initialCounts: CountData[];
  currentUser?: {
    id: string;
    username: string;
    fullName: string;
    role: 'admin' | 'auditor' | 'operator';
  } | null;
}

export default function CountingClient({
  session,
  initialItems,
  initialCounts,
  currentUser,
}: Props) {
  const [items, setItems] = useState<ItemData[]>(initialItems);
  const [recentCounts, setRecentCounts] = useState<CountData[]>(initialCounts);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);

  // Rol del usuario actual
  const userRole = currentUser?.role || 'operator';
  const isAuditorOrAdmin = userRole === 'admin' || userRole === 'auditor';

  // Form states
  const [scanInput, setScanInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitMode, setUnitMode] = useState<'unit' | 'pack'>('pack');
  const [operatorName, setOperatorName] = useState(
    currentUser?.fullName || 'Operador 1'
  );
  const [scanLocation, setScanLocation] = useState('');
  const [isRecount, setIsRecount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Search Modal state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Novelty Modal state (Operador)
  const [isNoveltyOpen, setIsNoveltyOpen] = useState(false);
  const [noveltyType, setNoveltyType] = useState<string>('cruce_mercancia');
  const [noveltyQty, setNoveltyQty] = useState<number>(1);
  const [noveltyBatch, setNoveltyBatch] = useState('');
  const [noveltyExpiry, setNoveltyExpiry] = useState('');
  const [noveltyNotes, setNoveltyNotes] = useState('');
  const [noveltyImage, setNoveltyImage] = useState<string | null>(null);
  const [isNoveltySubmitting, setIsNoveltySubmitting] = useState(false);

  // Auditor Recount Modal state
  const [isAuditorRecountOpen, setIsAuditorRecountOpen] = useState(false);
  const [recountPacks, setRecountPacks] = useState<number>(0);
  const [recountLoose, setRecountLoose] = useState<number>(0);
  const [recountReason, setRecountReason] = useState('');
  const [recountBatch, setRecountBatch] = useState('');
  const [recountExpiry, setRecountExpiry] = useState('');
  const [isRecountSubmitting, setIsRecountSubmitting] = useState(false);

  // Direct count optional batch and expiration
  const [directBatch, setDirectBatch] = useState('');
  const [directExpiry, setDirectExpiry] = useState('');

  // Auditor Cost Estimate Modal state
  // "modificar valores en medio del conteo (el sistema recibe el valor total por caja y lo calcula por unidad para sacar un valor estimado)"
  const [isCostEstimateOpen, setIsCostEstimateOpen] = useState(false);
  const [boxCostInput, setBoxCostInput] = useState<string>('');
  const [boxFactorInput, setBoxFactorInput] = useState<number>(1);
  const [costReason, setCostReason] = useState('');
  const [isCostSubmitting, setIsCostSubmitting] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Sync Hook
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncResult,
    triggerSync,
    cacheCatalogLocally,
    saveOfflineCount,
    saveOfflineNovelty,
  } = useInventorySync(session.id);

  // Inicializar Dexie Cache y leer Operador de localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedOp = localStorage.getItem('stocksync_operator');
      if (savedOp) setOperatorName(savedOp);

      // Cache items in IndexedDB
      const dexieItems = initialItems.map((item) => ({
        ...item,
        systemStock: Number(item.systemStock),
        rawCost: Number(item.rawCost),
        unitCostCalculated: Number(item.unitCostCalculated),
      }));
      cacheCatalogLocally(dexieItems);
    }
  }, [initialItems, cacheCatalogLocally]);

  // Autofocus en el input del escáner
  const focusScanner = () => {
    setTimeout(() => {
      barcodeInputRef.current?.focus();
      barcodeInputRef.current?.select();
    }, 50);
  };

  useEffect(() => {
    focusScanner();
  }, [selectedItem]);

  // Búsqueda dinámica en tiempo real por Nombre, SKU o Código de Barras con incidencias
  const searchQuery = scanInput.trim().toLowerCase();

  const dynamicMatches = useMemo(() => {
    if (!searchQuery) return [];
    return items
      .filter((item) => {
        const matchName = item.description.toLowerCase().includes(searchQuery);
        const matchSku = item.sku.toLowerCase().includes(searchQuery);
        const matchBarcode = item.barcode
          ? item.barcode.toLowerCase().includes(searchQuery)
          : false;
        return matchName || matchSku || matchBarcode;
      })
      .map((item) => {
        // Calcular incidencias y estado en vivo para este ítem
        const itemCounts = recentCounts.filter((c) => c.itemId === item.id);
        const totalCounted = itemCounts.reduce(
          (acc, c) => acc + (Number(c.countedQuantity) || 0),
          0
        );
        const stock = Number(item.systemStock) || 0;
        const diff = totalCounted > 0 ? totalCounted - stock : 0;
        const hasDiscrepancy = totalCounted > 0 && Math.abs(diff) > 0.001;
        const systemBreakdown = formatStockBreakdown(stock, item.packQuantity);

        const incidences: { text: string; severity: 'warning' | 'info' | 'danger' }[] = [];
        if (item.requiresRecount) {
          incidences.push({ text: 'Requiere Reconteo', severity: 'warning' });
        }
        if (hasDiscrepancy) {
          incidences.push({
            text: diff > 0 ? `Sobrante (+${diff})` : `Faltante (${diff})`,
            severity: diff > 0 ? 'info' : 'danger',
          });
        }
        if (item.packQuantity <= 1) {
          incidences.push({ text: 'Factor 1x1 (Frasco/Unidad)', severity: 'info' });
        }

        return {
          ...item,
          totalCounted,
          hasDiscrepancy,
          diff,
          incidences,
          systemBreakdown,
        };
      })
      .slice(0, 7); // Top 7 sugerencias dinámicas
  }, [items, searchQuery, recentCounts]);

  const selectProduct = (item: ItemData) => {
    setSelectedItem(item);
    setScanLocation(item.location || '');
    setQuantity(1);
    if (item.packQuantity <= 1) {
      setUnitMode('pack');
    }
    setDirectBatch((item as any).batchNumber || '');
    setDirectExpiry(
      (item as any).expirationDate
        ? typeof (item as any).expirationDate === 'string'
          ? (item as any).expirationDate.split('T')[0]
          : new Date((item as any).expirationDate).toISOString().split('T')[0]
        : ''
    );
    setShowSuggestions(false);
    setScanInput('');
    setFeedbackMsg({
      text: `Producto seleccionado: ${item.description}`,
      type: 'success',
    });
    playFeedbackSound('success');
    logSearchAudit({
      sessionId: session.id,
      userId: operatorName,
      searchQuery: item.sku,
      searchType: 'description',
      resultsCount: 1,
    });
  };

  // Búsqueda por escáner o envío de formulario
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = scanInput.trim().toLowerCase();
    if (!query) return;

    // 1. Buscar coincidencia exacta por barcode o SKU
    let found = items.find(
      (item) =>
        (item.barcode && item.barcode.toLowerCase() === query) ||
        item.sku.toLowerCase() === query
    );

    // 2. Si no es exacto, seleccionar la primera coincidencia por nombre
    if (!found && dynamicMatches.length > 0) {
      found = dynamicMatches[0];
    }

    if (found) {
      selectProduct(found);
    } else {
      setFeedbackMsg({
        text: `No se encontró ningún artículo coincidente con: "${scanInput}"`,
        type: 'error',
      });
      playFeedbackSound('alert');
      logSearchAudit({
        sessionId: session.id,
        userId: operatorName,
        searchQuery: query,
        searchType: 'barcode',
        resultsCount: 0,
      });
    }
  };

  // Cálculo de desglose en vivo
  const breakdown = selectedItem
    ? calculateBreakdown(quantity, unitMode, selectedItem.packQuantity)
    : { countedPacks: 0, countedLoose: 0, countedQuantity: 0 };

  // Registrar conteo físico
  const handleRegisterCount = async () => {
    if (!selectedItem || quantity <= 0) return;
    setIsSubmitting(true);

    if (typeof window !== 'undefined') {
      localStorage.setItem('stocksync_operator', operatorName);
    }

    const payload = {
      sessionId: session.id,
      itemId: selectedItem.id,
      inputQuantity: quantity,
      inputUnit: unitMode,
      packQuantity: selectedItem.packQuantity,
      locationScanned: scanLocation || selectedItem.location,
      countedBy: operatorName,
      inputMethod: 'scanner' as const,
      isRecount,
      batchNumber: directBatch || null,
      expirationDate: directExpiry || null,
    };

    if (isOnline) {
      // Registro directo al servidor PostgreSQL
      const res = await recordDirectCount(payload);
      if (res.success && res.data) {
        setRecentCounts((prev) => [res.data as any, ...prev]);
        setFeedbackMsg({
          text: ` Conteo guardado: +${breakdown.countedQuantity} fracciones (${breakdown.countedPacks} u, ${breakdown.countedLoose} f)`,
          type: 'success',
        });
        playFeedbackSound('success');
      } else {
        // En caso de error inesperado, respaldo a Dexie
        await saveOfflineCount({
          clientUuid: crypto.randomUUID(),
          sessionId: session.id,
          itemId: selectedItem.id,
          inputQuantity: quantity,
          inputUnit: unitMode,
          countedPacks: breakdown.countedPacks,
          countedLoose: breakdown.countedLoose,
          countedQuantity: breakdown.countedQuantity,
          locationScanned: scanLocation || selectedItem.location,
          countedBy: operatorName,
          inputMethod: 'scanner',
          isRecount,
          countedAt: new Date().toISOString(),
        });
        setFeedbackMsg({
          text: ' Servidor no respondió, conteo respaldado en memoria local (offline)',
          type: 'error',
        });
      }
    } else {
      // Modo Offline: Dexie Storage
      await saveOfflineCount({
        clientUuid: crypto.randomUUID(),
        sessionId: session.id,
        itemId: selectedItem.id,
        inputQuantity: quantity,
        inputUnit: unitMode,
        countedPacks: breakdown.countedPacks,
        countedLoose: breakdown.countedLoose,
        countedQuantity: breakdown.countedQuantity,
        locationScanned: scanLocation || selectedItem.location,
        countedBy: operatorName,
        inputMethod: 'scanner',
        isRecount,
        countedAt: new Date().toISOString(),
      });
      setFeedbackMsg({
        text: ` Guardado OFFLINE (+${breakdown.countedQuantity} fracciones). Se sincronizará al reconectar.`,
        type: 'success',
      });
      playFeedbackSound('success');
    }

    setIsSubmitting(false);
    setScanInput('');
    focusScanner();
  };

  // Registrar novedad del operador (con opción de solicitar revisión de cruce o mal estado)
  const handleSaveNovelty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || noveltyQty <= 0) return;

    setIsNoveltySubmitting(true);
    const payload = {
      sessionId: session.id,
      itemId: selectedItem.id,
      noveltyType,
      quantity: noveltyQty,
      batchNumber: noveltyBatch || null,
      expirationDate: noveltyExpiry || null,
      imageUrl: noveltyImage || null,
      notes: noveltyNotes || null,
      reportedBy: operatorName,
    };

    if (isOnline) {
      const res = await recordOperatorNovelty(payload);
      if (res.success) {
        if (noveltyType === 'cruce_mercancia') {
          // Marcar localmente el ítem como en reconteo / revisión
          setSelectedItem({ ...selectedItem, requiresRecount: true });
          setItems((prev) =>
            prev.map((i) =>
              i.id === selectedItem.id ? { ...i, requiresRecount: true } : i
            )
          );
          setFeedbackMsg({
            text: `⚠️ Solicitud de revisión de cruce enviada al Administrador. Ítem marcado para reconteo.`,
            type: 'success',
          });
        } else {
          setFeedbackMsg({
            text: ` Novedad registrada con éxito (${noveltyType})`,
            type: 'success',
          });
        }
        playFeedbackSound('success');
      }
    } else {
      await saveOfflineNovelty({
        clientUuid: crypto.randomUUID(),
        sessionId: session.id,
        itemId: selectedItem.id,
        noveltyType,
        quantity: noveltyQty,
        batchNumber: noveltyBatch || null,
        expirationDate: noveltyExpiry || null,
        notes: noveltyNotes || null,
        reportedBy: operatorName,
        createdAt: new Date().toISOString(),
      });
      setFeedbackMsg({
        text: ` Novedad guardada OFFLINE`,
        type: 'success',
      });
    }

    setIsNoveltySubmitting(false);
    setIsNoveltyOpen(false);
    setNoveltyNotes('');
    setNoveltyBatch('');
    setNoveltyExpiry('');
    setNoveltyImage(null);
  };

  // RECONTEO FORMAL DE AUDITORÍA (AUDITORES Y ADMINISTRADORES)
  const handleSaveAuditorRecount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!recountReason.trim()) {
      alert('Debes ingresar una justificación legal para el reconteo de auditoría.');
      return;
    }

    setIsRecountSubmitting(true);
    try {
      const res = await executeAuditorRecount({
        sessionId: session.id,
        itemId: selectedItem.id,
        newPacks: Number(recountPacks) || 0,
        newLoose: selectedItem.packQuantity <= 1 ? 0 : (Number(recountLoose) || 0),
        reason: recountReason,
        operatorOverrideName: operatorName,
        batchNumber: recountBatch || null,
        expirationDate: recountExpiry || null,
      });

      if (res.success && res.data) {
        setRecentCounts((prev) => [res.data as any, ...prev]);
        setSelectedItem((prev) => (prev ? { ...prev, requiresRecount: false } : null));
        setItems((prev) =>
          prev.map((i) =>
            i.id === selectedItem.id ? { ...i, requiresRecount: false } : i
          )
        );
        setFeedbackMsg({
          text: `Reconteo de auditoría asentado con éxito: ${recountPacks} u ${recountLoose} f (${res.newTotalFractions} fracc.)`,
          type: 'success',
        });
        playFeedbackSound('success');
        setIsAuditorRecountOpen(false);
        setRecountReason('');
      } else {
        alert(res.error || 'Error al asentar reconteo');
      }
    } catch (err: any) {
      alert(err.message || 'Error de comunicación');
    } finally {
      setIsRecountSubmitting(false);
    }
  };

  // MODIFICAR VALOR POR CAJA / ESTIMACIÓN (AUDITORES Y ADMINISTRADORES)
  // "el sistema recibe el valor total por caja y lo calcula por unidad para sacar un valor estimado"
  const handleSaveCostEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    const boxCostNum = Number(boxCostInput);
    if (isNaN(boxCostNum) || boxCostNum <= 0) {
      alert('Ingresa un valor válido para el costo por caja.');
      return;
    }
    if (!costReason.trim()) {
      alert('Debes ingresar una justificación legal para el cambio de costo estimado.');
      return;
    }

    setIsCostSubmitting(true);
    try {
      const res = await updateItemCostEstimate({
        sessionId: session.id,
        itemId: selectedItem.id,
        boxCost: boxCostNum,
        packQuantity: boxFactorInput,
        reason: costReason,
        operatorOverrideName: operatorName,
      });

      if (res.success && res.unitCostCalculated !== undefined) {
        const newCost = res.unitCostCalculated;
        const newFactor = res.packQuantity;
        setSelectedItem((prev) =>
          prev
            ? {
                ...prev,
                rawCost: boxCostNum,
                costBasis: 'pack',
                packQuantity: newFactor,
                unitCostCalculated: newCost,
              }
            : null
        );
        setItems((prev) =>
          prev.map((i) =>
            i.id === selectedItem.id
              ? {
                  ...i,
                  rawCost: boxCostNum,
                  costBasis: 'pack',
                  packQuantity: newFactor,
                  unitCostCalculated: newCost,
                }
              : i
          )
        );
        setFeedbackMsg({
          text: `Valor por caja ($${boxCostNum}) actualizado. Costo estimado por fracción: $${newCost.toFixed(4)}`,
          type: 'success',
        });
        playFeedbackSound('success');
        setIsCostEstimateOpen(false);
        setCostReason('');
      } else {
        alert(res.error || 'Error al actualizar valor por caja');
      }
    } catch (err: any) {
      alert(err.message || 'Error de comunicación');
    } finally {
      setIsCostSubmitting(false);
    }
  };

  // Toggle bandera de reconteo
  const handleToggleRecount = async () => {
    if (!selectedItem) return;
    const newFlag = !selectedItem.requiresRecount;
    await toggleItemRecountFlag(selectedItem.id, newFlag);
    setSelectedItem({ ...selectedItem, requiresRecount: newFlag });
    setItems((prev) =>
      prev.map((i) =>
        i.id === selectedItem.id ? { ...i, requiresRecount: newFlag } : i
      )
    );
  };

  // Filtrado modal de búsqueda manual
  const filteredItems = items.filter(
    (item) =>
      item.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.barcode && item.barcode.includes(searchFilter))
  );

  return (
    <div className="space-y-6">
      {/* Barra superior de sesión y conectividad */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-black/20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Volver a sesiones"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {session.title}
              </h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  session.status === 'in_progress'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {session.status === 'in_progress' ? 'En Curso' : 'Cerrada'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Creada por: <span className="text-slate-300">{session.createdBy}</span> • {items.length} productos en catálogo
            </p>
          </div>
        </div>

        {/* Indicadores de sincronización y estado de red */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              isOnline
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                : 'bg-rose-950/40 text-rose-400 border-rose-800/60 animate-pulse'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4" />
                <span>ONLINE (Servidor Activo)</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span>OFFLINE (Modo Local Dexie)</span>
              </>
            )}
          </div>

          {/* Botón de Sincronización Manual */}
          <button
            onClick={triggerSync}
            disabled={isSyncing || pendingCount === 0}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pendingCount > 0
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30'
                : 'bg-slate-700/50 text-slate-400 cursor-default'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {isSyncing
                ? 'Sincronizando...'
                : pendingCount > 0
                ? `Sincronizar (${pendingCount})`
                : 'Sincronizado'}
            </span>
          </button>

          <Link
            href={`/sesion/${session.id}/reporte`}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ver Reporte & Cierre</span>
          </Link>
        </div>
      </div>

      {/* Banner de mensajes y feedback sonoro/visual */}
      {feedbackMsg && (
        <div
          className={`px-4 py-3 rounded-xl border flex items-center justify-between transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
              : 'bg-rose-950/40 border-rose-700/60 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 text-sm">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-white text-xs ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid Principal: Escáner y Conteo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Input de Escáner y Ficha de Conteo */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card del Escáner y Búsqueda Dinámica */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 shadow-lg backdrop-blur-sm relative">
            <label className="block text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Barcode className="w-4 h-4" />
                Búsqueda Dinámica por Nombre, SKU o Código de Barras
              </span>
              {scanInput && (
                <span className="text-[11px] text-slate-400 font-normal">
                  {dynamicMatches.length} coincidencia(s)
                </span>
              )}
            </label>

            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Digita nombre (ej: Exforge, Daflon), SKU o escanea código..."
                  value={scanInput}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(e) => {
                    setScanInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  className="w-full bg-slate-900 border-2 border-slate-700 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 text-white font-mono text-base sm:text-lg px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-400"
                />
                {scanInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setScanInput('');
                      setShowSuggestions(false);
                      focusScanner();
                    }}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-cyan-600/20"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Seleccionar</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3.5 rounded-xl flex items-center transition-colors"
                title="Explorar catálogo completo"
              >
                <Layers className="w-4 h-4" />
              </button>
            </form>

            {/* DESPLIEGUE DINÁMICO DE DATOS E INCIDENCIAS MIENTRAS EL USUARIO DIGITA */}
            {showSuggestions && scanInput.trim().length > 0 && (
              <div className="mt-3 bg-slate-900/95 border border-cyan-500/50 rounded-xl p-3 shadow-2xl space-y-2 max-h-72 overflow-y-auto">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px] text-slate-400 font-semibold">
                  <span>RESULTADOS DINÁMICOS MIENTRAS DIGITAS</span>
                  <span>Presiona ENTER para elegir el primero o haz clic</span>
                </div>

                {dynamicMatches.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No se encontraron artículos con el término "{scanInput}".
                  </div>
                ) : (
                  dynamicMatches.map((match) => (
                    <div
                      key={match.id}
                      onClick={() => selectProduct(match)}
                      className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs hover:text-cyan-300 transition-colors flex items-center gap-2">
                          <span>{match.description}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-cyan-300 font-bold">SKU: {match.sku}</span>
                          {match.barcode && <span>• Barcode: {match.barcode}</span>}
                          <span>• Factor: 1x{match.packQuantity} un</span>
                          {match.location && <span>• Ubic: {match.location}</span>}
                        </div>

                        {/* Incidencias dinámicas visuales */}
                        {match.incidences.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {match.incidences.map((inc, i) => (
                              <span
                                key={i}
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                  inc.severity === 'warning'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : inc.severity === 'danger'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                }`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {inc.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 block font-medium">Stock Teórico</span>
                        <span className="text-sm font-bold font-mono text-emerald-400 block">
                          {match.systemBreakdown.formatted}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ({match.systemStock} fracc.)
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Busca por nombre en tiempo real o escanea código</span>
              <button
                type="button"
                onClick={() => {
                  if (items.length > 0) {
                    const random = items[Math.floor(Math.random() * items.length)];
                    selectProduct(random);
                  }
                }}
                className="text-cyan-400 hover:underline flex items-center gap-1 font-mono"
              >
                <Sparkles className="w-3 h-3" /> Probar ítem demo
              </button>
            </div>
          </div>

          {/* Ficha del Producto Seleccionado y Captura de Conteo */}
          {selectedItem ? (
            <div className="bg-slate-800/80 border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
              {/* Encabezado del Producto */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-700/80 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                      SKU: {selectedItem.sku}
                    </span>
                    {selectedItem.barcode && (
                      <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-slate-700/80 text-slate-300">
                        {selectedItem.barcode}
                      </span>
                    )}
                    {selectedItem.location && (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-700/40 text-slate-300">
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        {selectedItem.location}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-white mt-2 leading-snug">
                    {selectedItem.description}
                  </h2>
                </div>

                <button
                  onClick={handleToggleRecount}
                  className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    selectedItem.requiresRecount
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                  title="Marcar si este ítem requiere reconteo obligatorio"
                >
                  <AlertOctagon className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {selectedItem.requiresRecount ? 'En Reconteo' : 'Marcar Reconteo'}
                  </span>
                </button>
              </div>

              {/* Parámetros de Empaque y Costo Teórico */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/50 text-xs">
                <div>
                  <span className="text-slate-400 block">Fracciones por Unidad:</span>
                  <span className="text-white font-bold text-sm flex items-center gap-1 mt-0.5">
                    <Package className="w-3.5 h-3.5 text-cyan-400" />
                    1 Unidad = {selectedItem.packQuantity} fracciones
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Stock Teórico:</span>
                  <span className="text-white font-bold text-sm mt-0.5 block font-mono">
                    {formatStockBreakdown(Number(selectedItem.systemStock), selectedItem.packQuantity).formatted}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    ({Number(selectedItem.systemStock)} fracciones)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Costo Fracción:</span>
                  <span className="text-emerald-400 font-bold text-sm mt-0.5 block">
                    ${Number(selectedItem.unitCostCalculated).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* PANEL DE CONTROL DE AUDITORÍA Y RECONTEO (Solo Auditores y Administradores) */}
              {isAuditorOrAdmin ? (
                <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-slate-900 border border-amber-500/30 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-amber-400" />
                      Herramientas de Auditoría (Trazabilidad Legal)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Rol: {userRole.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const curCounts = recentCounts.filter((c) => c.itemId === selectedItem.id);
                        const totalCounts = curCounts.reduce((acc, c) => acc + (Number(c.countedQuantity) || 0), 0);
                        const curBreakdown = formatStockBreakdown(totalCounts, selectedItem.packQuantity);
                        setRecountPacks(curBreakdown.packs);
                        setRecountLoose(curBreakdown.loose);
                        setRecountReason('');
                        setIsAuditorRecountOpen(true);
                      }}
                      className="py-2.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      <History className="w-4 h-4 text-amber-400" />
                      <span>Reconteo Oficial de Auditoría</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const rawBoxCost = (Number(selectedItem.unitCostCalculated) || 0) * (selectedItem.packQuantity || 1);
                        setBoxCostInput(rawBoxCost > 0 ? rawBoxCost.toFixed(2) : '');
                        setBoxFactorInput(selectedItem.packQuantity || 1);
                        setCostReason('');
                        setIsCostEstimateOpen(true);
                      }}
                      className="py-2.5 px-3 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      <Calculator className="w-4 h-4 text-indigo-400" />
                      <span>Modificar Valor por Caja / Estimado</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/40 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    Modo Operador: Captura física y reporte de novedades
                  </span>
                  <span className="text-[10px] text-amber-400/80 font-medium">Reconteos y costos reservados a Auditoría</span>
                </div>
              )}

              {/* Selector de Modo de Conteo: Unidades vs Fracciones */}
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
                  Tipo de Conteo
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUnitMode('pack')}
                    className={`py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border transition-all ${
                      unitMode === 'pack'
                        ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-600/20'
                        : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span>Unidades (u) - Enteras</span>
                  </button>
                  <button
                    type="button"
                    disabled={selectedItem.packQuantity <= 1}
                    onClick={() => {
                      if (selectedItem.packQuantity > 1) {
                        setUnitMode('unit');
                      }
                    }}
                    className={`py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border transition-all ${
                      selectedItem.packQuantity <= 1
                        ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                        : unitMode === 'unit'
                        ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-600/20'
                        : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>{selectedItem.packQuantity <= 1 ? 'No fracciona (1x1)' : 'Fracciones (f) - Sueltas'}</span>
                  </button>
                </div>
              </div>

              {/* Entrada de Cantidad con Steppers Rápidos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Cantidad Contada ({unitMode === 'pack' ? 'Unidades' : 'Fracciones'})
                  </label>
                  <div className="flex gap-1.5">
                    {[1, 5, 10, 20].map((increment) => (
                      <button
                        key={increment}
                        type="button"
                        onClick={() => setQuantity((q) => q + increment)}
                        className="text-xs bg-slate-700/60 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded-lg font-mono transition-colors"
                      >
                        +{increment}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-12 h-12 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white text-xl font-bold transition-colors"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="flex-1 bg-slate-900 border-2 border-slate-700 focus:border-cyan-500 text-center font-mono text-2xl font-bold text-white py-2 rounded-xl outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-12 h-12 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white text-xl font-bold transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Preview del Desglose Automático */}
              <div className="bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-800/60 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-cyan-400 font-semibold block">
                    DESGLOSE AUTOMÁTICO CALCULADO
                  </span>
                  <div className="flex items-center gap-2 text-white font-mono text-lg font-bold mt-1">
                    <span>{breakdown.countedPacks} Unidades (u)</span>
                    <span className="text-slate-400">+</span>
                    <span>{breakdown.countedLoose} Fracciones (f)</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Total Fracciones Base</span>
                  <span className="text-cyan-300 font-mono text-2xl font-black">
                    {breakdown.countedQuantity}
                  </span>
                </div>
              </div>

              {/* Lote y Fecha de Vencimiento Opcional con Alerta de Cuarentena */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-900/50 p-3.5 rounded-xl border border-slate-700/60">
                <div>
                  <label className="text-slate-400 block mb-1">Lote / Batch (opcional):</label>
                  <input
                    type="text"
                    placeholder="Ej: L-48920"
                    value={directBatch}
                    onChange={(e) => setDirectBatch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Fecha de Vencimiento (opcional):</label>
                  <input
                    type="date"
                    value={directExpiry}
                    onChange={(e) => setDirectExpiry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono outline-none focus:border-cyan-500"
                  />
                </div>

                {directExpiry && (() => {
                  const exp = new Date(directExpiry);
                  const diffDays = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  if (diffDays <= 0) {
                    return (
                      <div className="sm:col-span-2 p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5">
                        <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
                        <span>🔴 PRODUCTO VENCIDO (Venció hace {Math.abs(diffDays)} días)</span>
                      </div>
                    );
                  }
                  if (diffDays <= 90) {
                    return (
                      <div className="sm:col-span-2 p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-2 animate-pulse">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>⚠️ PRÓXIMO A VENCER ({diffDays} DÍAS / &lt; 3 MESES) - MARCAR PARA CUSTODIA O CUARENTENA</span>
                      </div>
                    );
                  }
                  return (
                    <div className="sm:col-span-2 p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      <span>🟢 Vigente ({diffDays} días restantes)</span>
                    </div>
                  );
                })()}
              </div>

              {/* Datos de Auditoría / Operador */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Nombre Operador / Conteo:</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Ubicación Física Escaneada:</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Ej: Pasillo A, Estante 2"
                      value={scanLocation}
                      onChange={(e) => setScanLocation(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Botón Principal de Registro */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleRegisterCount}
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all text-base disabled:opacity-50"
                >
                  <ClipboardCheck className="w-5 h-5" />
                  <span>
                    {isSubmitting
                      ? 'Registrando...'
                      : `REGISTRAR CONTEO (+${breakdown.countedQuantity} FRACCIONES)`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsNoveltyOpen(true)}
                  className="bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 px-4 py-3.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Reportar Novedad</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-2xl p-12 text-center">
              <Package className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-300">
                Ningún artículo escaneado
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Usa la pistola de código de barras para leer la etiqueta o ingresa el SKU arriba para comenzar a contar.
              </p>
            </div>
          )}
        </div>

        {/* Columna Derecha: Historial de Conteos Recientes de la Sesión */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-sm text-white">Conteos Registrados</h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-700 text-slate-300 font-mono">
                {recentCounts.length} registros
              </span>
            </div>

            <div className="mt-4 space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {recentCounts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  Aún no se han registrado conteos en esta sesión.
                </p>
              ) : (
                recentCounts.map((count, idx) => {
                  const item = items.find((i) => i.id === count.itemId);
                  return (
                    <div
                      key={count.id || idx}
                      className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 text-xs flex items-center justify-between hover:border-slate-600 transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{item ? item.description : 'Artículo'}</span>
                          {count.isRecount && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/30">
                              Reconteo
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>SKU: {item?.sku || '---'}</span>
                          <span>•</span>
                          <span>
                            {count.countedPacks} u, {count.countedLoose} f
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                          <span>Por: {count.countedBy}</span>
                          <span>•</span>
                          <span>
                            {new Date(count.countedAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold font-mono text-cyan-300 block">
                          +{count.countedQuantity}
                        </span>
                        <span className="text-[10px] text-slate-400">fracc.</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Búsqueda Manual de Productos */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan-400" />
                Catálogo de Artículos ({items.length})
              </h3>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="Filtrar por nombre, SKU o código de barras..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl text-sm outline-none focus:border-cyan-500"
              autoFocus
            />

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item);
                    setScanLocation(item.location || '');
                    setScanInput(item.barcode || item.sku);
                    setIsSearchOpen(false);
                    playFeedbackSound('success');
                  }}
                  className="bg-slate-800/60 hover:bg-cyan-950/40 hover:border-cyan-500/50 border border-slate-700/60 p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white block">
                      {item.description}
                    </span>
                    <span className="text-slate-400 font-mono">
                      SKU: {item.sku} • Código: {item.barcode || 'N/A'} • Factor: {item.packQuantity} unids/caja
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block font-medium">Stock Teórico</span>
                    <span className="text-emerald-400 font-mono font-bold block text-sm">
                      {formatStockBreakdown(Number(item.systemStock), item.packQuantity).formatted}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      ({Number(item.systemStock)} fracc.)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reportar Novedad (Operador) */}
      {isNoveltyOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveNovelty}
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Reportar Novedad de Inventario
              </h3>
              <button
                type="button"
                onClick={() => setIsNoveltyOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Producto</span>
              <span className="font-bold text-white block mt-0.5">{selectedItem.description}</span>
              <span className="font-mono text-cyan-400 text-[11px] block mt-0.5">SKU: {selectedItem.sku}</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Tipo de Novedad
              </label>
              <select
                value={noveltyType}
                onChange={(e) => setNoveltyType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-amber-500"
              >
                <option value="cruce_mercancia">🔀 Solicitar al Administrador Revisión de Cruce</option>
                <option value="mal_estado_averia">⚠️ Reportar Mal Estado o Avería Física</option>
                <option value="proxima_vencer">📅 Reportar Fecha Próxima a Vencer</option>
                <option value="otro">📝 Otra Novedad de Inventario</option>
              </select>

              {noveltyType === 'cruce_mercancia' && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    Se registrará una alerta prioritaria para el Administrador y el producto quedará marcado formalmente en espera de revisión o reconteo.
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Cantidad Afectada</label>
                <input
                  type="number"
                  min="1"
                  value={noveltyQty}
                  onChange={(e) => setNoveltyQty(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl outline-none focus:border-amber-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Lote (Batch #) {noveltyType === 'proxima_vencer' && <span className="text-rose-400">*</span>}
                </label>
                <input
                  type="text"
                  placeholder="Ej: L-98124"
                  value={noveltyBatch}
                  onChange={(e) => setNoveltyBatch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl outline-none focus:border-amber-500 font-mono"
                  required={noveltyType === 'proxima_vencer'}
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="text-slate-300 font-semibold block mb-1">
                Fecha de Vencimiento {noveltyType === 'proxima_vencer' && <span className="text-rose-400">*</span>}
              </label>
              <input
                type="date"
                value={noveltyExpiry}
                onChange={(e) => setNoveltyExpiry(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl outline-none focus:border-amber-500"
                required={noveltyType === 'proxima_vencer'}
              />
            </div>

            <div className="text-xs">
              <label className="text-slate-300 font-semibold block mb-1">
                {noveltyType === 'cruce_mercancia'
                  ? 'Detalles del Cruce (indica SKU o producto con el que se cruzó)'
                  : 'Observaciones / Notas'}
              </label>
              <textarea
                placeholder={
                  noveltyType === 'cruce_mercancia'
                    ? 'Indica con qué código, estante o producto sospechas que hubo inversión física...'
                    : 'Detalla el estado físico del producto...'
                }
                value={noveltyNotes}
                onChange={(e) => setNoveltyNotes(e.target.value)}
                rows={3}
                required={noveltyType === 'cruce_mercancia'}
                className="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-xl outline-none focus:border-amber-500 text-xs"
              />
            </div>

            {/* Foto / Evidencia de la Novedad (Móvil o PC) */}
            <div className="text-xs pt-1 border-t border-slate-800">
              <label className="text-slate-300 font-semibold block mb-1">
                Foto de Evidencia / Avería o Etiqueta (opcional)
              </label>
              <div className="flex items-center gap-3">
                {noveltyImage && (
                  <div className="relative">
                    <img
                      src={noveltyImage}
                      alt="Evidencia"
                      className="w-14 h-14 object-cover rounded-xl border border-amber-500/50 shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setNoveltyImage(null)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold"
                    >
                      ×
                    </button>
                  </div>
                )}
                <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-amber-300 font-bold flex items-center gap-2 transition-colors">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>{noveltyImage ? 'Cambiar Foto' : 'Tomar Foto / Subir Imagen'}</span>
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
                          setNoveltyImage(base64);
                        } catch (err: any) {
                          alert('Error al procesar la imagen: ' + err.message);
                        }
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNoveltyOpen(false)}
                className="flex-1 bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isNoveltySubmitting}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl text-xs font-bold shadow-md shadow-amber-600/30 disabled:opacity-50 cursor-pointer"
              >
                {isNoveltySubmitting ? 'Enviando...' : 'Enviar Reporte'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: RECONTEO OFICIAL DE AUDITORÍA (AUDITOR Y ADMINISTRADOR) */}
      {isAuditorRecountOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveAuditorRecount}
            className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Reconteo Oficial de Auditoría</h3>
                  <span className="text-[10px] text-amber-300 font-mono">Registro Legal Inmutable</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditorRecountOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Producto a Reconociliar</span>
              <span className="font-bold text-white block mt-0.5">{selectedItem.description}</span>
              <div className="flex items-center gap-3 mt-1 text-slate-300 font-mono text-[11px]">
                <span>SKU: {selectedItem.sku}</span>
                <span>• Factor: 1x{selectedItem.packQuantity}</span>
                <span>• Teórico: {formatStockBreakdown(Number(selectedItem.systemStock), selectedItem.packQuantity).formatted}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Unidades (u) - Cajas
                </label>
                <input
                  type="number"
                  min="0"
                  value={recountPacks}
                  onChange={(e) => setRecountPacks(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Fracciones (f) - Sueltas
                  </label>
                  {selectedItem.packQuantity <= 1 && (
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                      No fracciona (1x1)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  disabled={selectedItem.packQuantity <= 1}
                  value={selectedItem.packQuantity <= 1 ? 0 : recountLoose}
                  onChange={(e) => setRecountLoose(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 disabled:opacity-40 disabled:bg-slate-900 rounded-xl text-white font-mono text-base font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Lote y Vencimiento en Reconteo */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Lote / Batch (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: L-4890"
                  value={recountBatch}
                  onChange={(e) => setRecountBatch(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Fecha Vencimiento (opcional)</label>
                <input
                  type="date"
                  value={recountExpiry}
                  onChange={(e) => setRecountExpiry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none focus:border-amber-500"
                />
              </div>

              {recountExpiry && (() => {
                const exp = new Date(recountExpiry);
                const diffDays = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (diffDays <= 0) {
                  return (
                    <div className="col-span-2 p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5">
                      <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>🔴 PRODUCTO VENCIDO (Venció hace {Math.abs(diffDays)} días)</span>
                    </div>
                  );
                }
                if (diffDays <= 90) {
                  return (
                    <div className="col-span-2 p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>⚠️ PRÓXIMO A VENCER ({diffDays} DÍAS / &lt; 3 MESES) - MARCAR PARA CUSTODIA O CUARENTENA</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Vista previa del total de reconteo */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Nuevo Conteo Físico Base:</span>
              <span className="font-mono font-black text-amber-300 text-sm">
                {(recountPacks * selectedItem.packQuantity) + recountLoose} fracciones ({recountPacks} u {recountLoose} f)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Justificación Legal del Reconteo <span className="text-rose-400">*</span>
              </label>
              <textarea
                placeholder="Indica la razón formal del reconteo (ej: Se encontró caja en gaveta contigua, confirmación física por auditoría)..."
                value={recountReason}
                onChange={(e) => setRecountReason(e.target.value)}
                rows={2}
                required
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAuditorRecountOpen(false)}
                className="flex-1 bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isRecountSubmitting}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-amber-600/30 disabled:opacity-50 cursor-pointer"
              >
                {isRecountSubmitting ? 'Certificando...' : 'Asentar Reconteo Legal'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: MODIFICAR VALOR POR CAJA / ESTIMADO (AUDITOR Y ADMINISTRADOR) */}
      {isCostEstimateOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCostEstimate}
            className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Modificar Valor por Caja</h3>
                  <span className="text-[10px] text-indigo-300">Cálculo Automático por Fracción Estimada</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCostEstimateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Producto</span>
              <span className="font-bold text-white block mt-0.5">{selectedItem.description}</span>
              <div className="flex items-center gap-3 mt-1 text-slate-300 font-mono text-[11px]">
                <span>SKU: {selectedItem.sku}</span>
                <span>• Costo Fracción Actual: ${Number(selectedItem.unitCostCalculated).toFixed(4)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Valor Total por Caja ($) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ej: 140.00"
                  value={boxCostInput}
                  onChange={(e) => setBoxCostInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Fracciones por Caja (Factor)
                </label>
                <input
                  type="number"
                  min="1"
                  value={boxFactorInput}
                  onChange={(e) => setBoxFactorInput(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Resultado del Cálculo Automático en Vivo */}
            <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-300">
                <span>Fórmula Aplicada:</span>
                <span className="font-mono text-indigo-300">Valor Caja ÷ Factor</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white font-bold">Costo Estimado por Unidad/Fracción:</span>
                <span className="font-mono font-black text-emerald-400 text-base">
                  ${boxCostInput && Number(boxCostInput) > 0 ? (Number(boxCostInput) / boxFactorInput).toFixed(4) : '0.0000'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Justificación del Ajuste de Valor <span className="text-rose-400">*</span>
              </label>
              <textarea
                placeholder="Indica el motivo de la actualización de costo (ej: Factura de proveedor rectificada, cambio de presentación)..."
                value={costReason}
                onChange={(e) => setCostReason(e.target.value)}
                rows={2}
                required
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCostEstimateOpen(false)}
                className="flex-1 bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCostSubmitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
              >
                {isCostSubmitting ? 'Calculando...' : 'Actualizar Valor Estimado'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
