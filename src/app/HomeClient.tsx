'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  Barcode,
  FileSpreadsheet,
  Server,
  CheckCircle2,
  Clock,
  Lock,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Search,
  Upload,
  Clipboard,
  Smartphone,
  AlertTriangle,
  FileText,
  Database,
  Check,
} from 'lucide-react';
import { createInventorySession } from '@/app/actions/sync';
import { importInventoryItems } from '@/app/actions/import';
import { duplicateInventorySessionAction } from '@/app/actions/session.actions';
import {
  parseCSVText,
  parseExcelBuffer,
  ParsedInventoryItem,
} from '@/lib/inventory-importer';
import { useRouter } from 'next/navigation';

interface SessionItem {
  id: string;
  title: string;
  status: string;
  createdBy: string;
  createdAt: Date | string;
  closedAt?: Date | string | null;
  closedHash?: string | null;
  itemsCount: number;
  countsCount: number;
}

export default function HomeClient({
  initialSessions,
}: {
  initialSessions: SessionItem[];
}) {
  const [sessions, setSessions] = useState<SessionItem[]>(initialSessions);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [createdBy, setCreatedBy] = useState('Auditor Principal');
  const [sessionType, setSessionType] = useState<'formal' | 'quick'>('formal');
  
  // Fuente de base de datos
  const [dbSource, setDbSource] = useState<'upload' | 'paste' | 'demo'>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedInventoryItem[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicatingSessionId, setDuplicatingSessionId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const router = useRouter();

  // Procesar archivo subido (Excel o CSV)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
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
        setParseError('No se encontraron filas de productos legibles en el archivo.');
      } else {
        setParsedItems(items);
        if (!title.trim()) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          setTitle(`Inventario - ${cleanName}`);
        }
      }
    } catch (err: any) {
      setParseError('Error al leer el archivo: ' + (err.message || 'Formato no soportado'));
    }
  };

  // Procesar texto pegado
  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;
    setParseError(null);
    try {
      const items = parseCSVText(pastedText);
      if (items.length === 0) {
        setParseError('No se pudieron extraer columnas reconocidas del texto.');
      } else {
        setParsedItems(items);
        if (!title.trim()) {
          setTitle(`Inventario Pegado - ${new Date().toLocaleDateString('es-ES')}`);
        }
      }
    } catch (err: any) {
      setParseError('Error al procesar texto: ' + err.message);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Ingresa un título para la sesión.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (dbSource === 'demo' || (parsedItems.length === 0 && dbSource !== 'upload')) {
        // Carga demo estándar
        const res = await createInventorySession({
          title,
          createdBy,
          seedDemoItems: true,
        });

        if (res.success && res.data) {
          setIsModalOpen(false);
          if (sessionType === 'quick') {
            router.push(`/inventario-rapido?sessionId=${res.data.id}`);
          } else {
            router.push(`/conteo/${res.data.id}`);
          }
        } else {
          alert('Error al crear sesión demo: ' + res.error);
        }
      } else {
        // Carga con base de datos real importada
        if (parsedItems.length === 0) {
          alert('Por favor selecciona un archivo con la base de datos o pega los datos para continuar.');
          setIsSubmitting(false);
          return;
        }

        const payloadItems = parsedItems.map((i) => ({
          sku: i.sku,
          description: i.description,
          systemStock: i.calculatedStock,
          packQuantity: i.factor,
          boxCost: i.boxCost,
          unitCostCalculated: i.unitCostCalculated,
          location: 'Bodega Principal',
        }));

        const res = await importInventoryItems({
          createNewSession: true,
          newSessionTitle: title,
          createdBy,
          sessionType,
          items: payloadItems,
        });

        if (res.success && res.sessionId) {
          setIsModalOpen(false);
          if (sessionType === 'quick') {
            router.push(`/inventario-rapido?sessionId=${res.sessionId}`);
          } else {
            router.push(`/conteo/${res.sessionId}`);
          }
        } else {
          alert('Error al importar la base de datos: ' + (res.error || 'Desconocido'));
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error del servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  // DUPLICAR SESIÓN EXISTENTE (conteo duplicado)
  const handleDuplicateSession = async (
    sessionId: string,
    sessionTitle: string
  ) => {
    setDuplicatingSessionId(sessionId);
    try {
      const newTitle = `Copia de ${sessionTitle}`;
      const res = await duplicateInventorySessionAction(sessionId, newTitle);

      if (res.success && res.newSessionId) {
        setSessions((prev) => [
          ...prev,
          {
            id: res.newSessionId,
            title: newTitle,
            status: 'in_progress',
            createdBy: 'Usuario',
            createdAt: new Date(),
            itemsCount: res.itemsDuplicated || 0,
            countsCount: res.countsDuplicated || 0,
          } as SessionItem,
        ]);
        alert(
          `Sesión duplicada correctamente.\n\n${res.itemsDuplicated} ítems copiados\n${res.countsDuplicated} conteos heredados\n${res.noveltiesDuplicated || 0} novedades copiadas`
        );
        router.push(`/conteo/${res.newSessionId}`);
      } else {
        alert('Error al duplicar sesión: ' + (res.error || 'Desconocido'));
      }
    } catch (err: any) {
      alert(err.message || 'Error al duplicar sesión');
    } finally {
      setDuplicatingSessionId(null);
    }
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    s.createdBy.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const activeCount = sessions.filter((s) => s.status === 'in_progress').length;
  const closedCount = sessions.filter((s) => s.status === 'closed').length;
  const totalCounts = sessions.reduce((acc, s) => acc + (s.countsCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Banner Principal Industrial */}
      <div className="bg-[#141416] border border-white/[0.08] rounded-2xl p-5 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[#A1A1AA] text-xs font-medium">
              <Database className="w-3.5 h-3.5 text-white/70 shrink-0" />
              <span>Conteo Físico • Offline First • Conciliación</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              Control de Inventario y Conteo Físico
            </h1>
            <p className="text-[#A1A1AA] text-xs sm:text-sm leading-relaxed">
              Captura inventarios con escáner de código de barras o manual, desglosa cajas y fracciones, opera sin conexión y concilia diferencias con precisión.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-white hover:bg-[#E4E4E7] text-[#0C0C0E] font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs sm:text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span>Nueva Sesión</span>
            </button>

            <Link
              href="/inventario-rapido"
              className="bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08] font-medium px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs sm:text-sm"
            >
              <Smartphone className="w-4 h-4 text-[#A1A1AA] shrink-0" />
              <span>Inventario Rápido</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Tarjetas KPI Industrial Graphite */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#141416] border border-white/[0.08] rounded-xl p-4">
          <span className="text-xs font-medium text-[#71717A] block mb-1">Sesiones Activas</span>
          <div className="text-2xl font-semibold text-white tracking-tight">{activeCount}</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">En proceso de conteo</span>
        </div>

        <div className="bg-[#141416] border border-white/[0.08] rounded-xl p-4">
          <span className="text-xs font-medium text-[#71717A] block mb-1">Sesiones Cerradas</span>
          <div className="text-2xl font-semibold text-emerald-400 tracking-tight">{closedCount}</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Con sello SHA-256</span>
        </div>

        <div className="bg-[#141416] border border-white/[0.08] rounded-xl p-4">
          <span className="text-xs font-medium text-[#71717A] block mb-1">Conteos Registrados</span>
          <div className="text-2xl font-semibold text-white tracking-tight">{totalCounts.toLocaleString()}</div>
          <span className="text-[11px] text-[#71717A] mt-1 block">Físicos capturados</span>
        </div>

        <div className="bg-[#141416] border border-white/[0.08] rounded-xl p-4">
          <span className="text-xs font-medium text-[#71717A] block mb-1">Base de Datos</span>
          <div className="text-2xl font-semibold text-white tracking-tight">PostgreSQL</div>
          <span className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Sincronización Activa
          </span>
        </div>
      </div>

      {/* Listado de Sesiones Existentes */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">Sesiones de Inventario</h2>
            <p className="text-xs text-[#71717A]">Historial de inventarios formales y muestreos rápidos.</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar sesión o auditor..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#17171A] border border-white/[0.08] rounded-lg text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="bg-[#141416] border border-white/[0.08] rounded-xl p-10 text-center space-y-3">
            <ClipboardList className="w-10 h-10 text-[#71717A] mx-auto" />
            <h3 className="text-sm font-semibold text-white">No hay sesiones de inventario</h3>
            <p className="text-xs text-[#71717A] max-w-sm mx-auto">
              Crea tu primera sesión cargando tu archivo de base de datos Excel o CSV.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-white text-[#0C0C0E] hover:bg-[#E4E4E7] font-semibold text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Nueva Sesión</span>
            </button>
          </div>
        ) : (
          <div className="bg-[#141416] border border-white/[0.08] rounded-xl divide-y divide-white/[0.06] overflow-hidden">
            {filteredSessions.map((session) => {
              const isClosed = session.status === 'closed';
              return (
                <div
                  key={session.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                        isClosed
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-white/[0.05] text-[#A1A1AA] border-white/[0.08]'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white text-sm leading-snug">
                          {session.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            isClosed
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                          }`}
                        >
                          {isClosed ? 'Sellada' : 'En Curso'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#71717A]">
                        <span>Auditor: <strong className="text-[#D4D4D8] font-medium">{session.createdBy}</strong></span>
                        <span>•</span>
                        <span>{new Date(session.createdAt).toLocaleDateString('es-ES')}</span>
                        <span>•</span>
                        <span className="font-mono text-[#A1A1AA]">
                          {session.itemsCount} productos • {session.countsCount} conteos
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción sobrios */}
                  <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.06] shrink-0">
                    <Link
                      href={`/conteo/${session.id}`}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white border border-white/[0.08] transition-colors text-center"
                    >
                      Conteo Físico
                    </Link>
                    <Link
                      href={`/sesion/${session.id}/reporte`}
                      className="px-3 py-1.5 rounded-lg bg-white text-[#0C0C0E] hover:bg-[#E4E4E7] text-xs font-semibold transition-colors text-center"
                    >
                      Reporte
                    </Link>
                    <button
                      onClick={() => handleDuplicateSession(session.id, session.title)}
                      disabled={duplicatingSessionId === session.id}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-[#A1A1AA] hover:text-white border border-white/[0.08] transition-colors text-center disabled:opacity-50 cursor-pointer"
                    >
                      {duplicatingSessionId === session.id ? 'Duplicando...' : 'Duplicar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: CREAR NUEVA SESIÓN CON CARGA FLEXIBLE DE BASE DE DATOS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSession}
            className="bg-[#17171A] border border-white/[0.08] rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] text-white flex items-center justify-center border border-white/[0.08]">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm sm:text-base">Nueva Sesión de Inventario</h3>
                  <span className="text-[11px] text-[#71717A]">Carga de base de datos para conteo</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#71717A] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Título de la Sesión */}
            <div>
              <label className="text-xs font-medium text-[#D4D4D8] block mb-1">
                Título de la Sesión <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej: Conteo Farmacia Central - Noviembre"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#111113] border border-white/[0.08] rounded-lg text-white text-xs focus:border-white/30 focus:outline-none"
                autoFocus
              />
            </div>

            {/* Auditor y Tipo de Conteo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#D4D4D8] block mb-1">
                  Responsable
                </label>
                <input
                  type="text"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111113] border border-white/[0.08] rounded-lg text-white text-xs focus:border-white/30 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#D4D4D8] block mb-1">
                  Modalidad de Conteo
                </label>
                <select
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#111113] border border-white/[0.08] rounded-lg text-white text-xs focus:border-white/30 focus:outline-none"
                >
                  <option value="formal">Conteo Formal (Auditoría & Escáner)</option>
                  <option value="quick">Inventario Rápido (Móvil / Muestreo)</option>
                </select>
              </div>
            </div>

            {/* SELECCIÓN Y CARGA DE LA BASE DE DATOS */}
            <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
              <label className="text-xs font-semibold text-white flex items-center justify-between">
                <span>Base de Datos de Productos</span>
                <span className="text-[10px] text-[#A1A1AA] font-mono">ID • Stk-Sis • Producto • Costo</span>
              </label>

              {/* Selector de Pestañas de Carga */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#111113] rounded-lg border border-white/[0.08] text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setDbSource('upload')}
                  className={`py-1.5 rounded-md transition-colors ${
                    dbSource === 'upload'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-[#71717A] hover:text-white'
                  }`}
                >
                  Subir Archivo
                </button>
                <button
                  type="button"
                  onClick={() => setDbSource('paste')}
                  className={`py-1.5 rounded-md transition-colors ${
                    dbSource === 'paste'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-[#71717A] hover:text-white'
                  }`}
                >
                  Pegar Texto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDbSource('demo');
                    setParsedItems([]);
                    setFileName(null);
                  }}
                  className={`py-1.5 rounded-md transition-colors ${
                    dbSource === 'demo'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-[#71717A] hover:text-white'
                  }`}
                >
                  Usar Demo
                </button>
              </div>

              {/* SUBIR ARCHIVO */}
              {dbSource === 'upload' && (
                <div className="space-y-2">
                  <div className="border border-dashed border-white/[0.15] hover:border-white/30 rounded-xl p-4 text-center cursor-pointer transition-colors relative bg-[#111113]/60">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-6 h-6 text-[#A1A1AA] mx-auto mb-1" />
                    <span className="text-xs font-medium text-white block">
                      {fileName ? fileName : 'Selecciona o arrastra el archivo Excel (.xlsx / .csv)'}
                    </span>
                    <span className="text-[10px] text-[#71717A] block mt-0.5 font-mono">
                      Columnas: Cód ID, Descripción, Stock Sistema, Costo
                    </span>
                  </div>
                </div>
              )}

              {/* PEGAR PORTAPAPELES */}
              {dbSource === 'paste' && (
                <div className="space-y-2">
                  <textarea
                    placeholder="Pega las filas copiadas desde Excel o archivo CSV (ID, Stk-Sis, Producto, Valor)..."
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    rows={3}
                    className="w-full p-2.5 bg-[#111113] border border-white/[0.08] rounded-lg text-white text-xs font-mono focus:border-white/30 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    className="w-full py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-medium border border-white/[0.08] transition-colors"
                  >
                    Interpretar Datos Pegados
                  </button>
                </div>
              )}

              {/* USAR BASE DEMO */}
              {dbSource === 'demo' && (
                <div className="p-3 rounded-lg bg-[#111113] border border-white/[0.08] text-xs space-y-1">
                  <span className="font-semibold text-white block">8 Artículos de Muestra Farmacéuticos</span>
                  <p className="text-[11px] text-[#71717A]">
                    Incluye factores de empaque (x30, x10, x50), códigos de barra y costos de impacto para pruebas inmediatas.
                  </p>
                </div>
              )}

              {/* Resumen en vivo de detección */}
              {parsedItems.length > 0 && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>{parsedItems.length} productos detectados</strong> (con factor y valor).
                    </span>
                  </div>
                  <span className="font-mono text-[10px] font-semibold text-emerald-400">
                    {parsedItems.filter((i) => i.boxCost > 0).length} valorizados
                  </span>
                </div>
              )}

              {parseError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>

            {/* BOTONES DE CREACIÓN */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-white/[0.06] text-[#A1A1AA] hover:text-white text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-white text-[#0C0C0E] hover:bg-[#E4E4E7] text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting
                  ? 'Importando...'
                  : sessionType === 'quick'
                  ? 'Iniciar Inventario Rápido'
                  : 'Iniciar Conteo Formal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
