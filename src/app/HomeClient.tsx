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
  Sparkles,
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

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    s.createdBy.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const activeCount = sessions.filter((s) => s.status === 'in_progress').length;
  const closedCount = sessions.filter((s) => s.status === 'closed').length;
  const totalCounts = sessions.reduce((acc, s) => acc + (s.countsCount || 0), 0);

  return (
    <div className="space-y-8">
      {/* Banner Principal / Hero */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/80 text-cyan-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Conteo Físico • Offline First • Conciliación Automática</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Control de Inventario y Conteo Físico
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Captura inventarios con escáner de código de barras o manual, desglosa cajas y fracciones al instante, almacena sin conexión con Dexie y sincroniza automáticamente con PostgreSQL.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 transition-all hover:scale-[1.02] text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Sesión con Base de Datos</span>
            </button>

            <Link
              href="/inventario-rapido"
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
            >
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>Inventario Rápido</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-medium text-slate-400 block mb-1">Sesiones Activas</span>
          <div className="text-2xl sm:text-3xl font-black text-cyan-400">{activeCount}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">En proceso de conteo</span>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-medium text-slate-400 block mb-1">Sesiones Cerradas</span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">{closedCount}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Con sello SHA-256</span>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-medium text-slate-400 block mb-1">Conteos Registrados</span>
          <div className="text-2xl sm:text-3xl font-black text-white">{totalCounts.toLocaleString()}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Físicos capturados</span>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-medium text-slate-400 block mb-1">Base de Datos</span>
          <div className="text-2xl sm:text-3xl font-black text-indigo-400">PostgreSQL</div>
          <span className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Drizzle ORM Sincronizado
          </span>
        </div>
      </div>

      {/* Listado de Sesiones Existentes */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Sesiones de Inventario</h2>
            <p className="text-xs text-slate-400">Historial de inventarios formales y muestreos rápidos.</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar sesión o auditor..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <ClipboardList className="w-12 h-12 text-slate-500 mx-auto" />
            <h3 className="text-base font-bold text-white">No hay sesiones de inventario</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Crea tu primera sesión cargando tu archivo de base de datos Excel o CSV.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Nueva Sesión</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all shadow-lg flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white text-base leading-snug">{session.title}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 border ${
                        session.status === 'closed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {session.status === 'closed' ? 'Sellada' : 'En Curso'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <div>Auditor: <strong className="text-slate-300">{session.createdBy}</strong></div>
                    <div>Fecha: {new Date(session.createdAt).toLocaleDateString('es-ES')}</div>
                    <div className="text-cyan-400 font-mono font-medium">
                      {session.itemsCount} productos • {session.countsCount} conteos
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center gap-2">
                  <Link
                    href={`/conteo/${session.id}`}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 text-center transition-all"
                  >
                    Conteo Físico
                  </Link>
                  <Link
                    href={`/sesion/${session.id}/reporte`}
                    className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold text-center transition-all shadow-md shadow-cyan-600/20"
                  >
                    Reporte
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: CREAR NUEVA SESIÓN CON CARGA FLEXIBLE DE BASE DE DATOS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSession}
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Nueva Sesión de Inventario</h3>
                  <span className="text-[10px] text-slate-400">Carga flexible de base de datos para conteo</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Título de la Sesión */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Título de la Sesión <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej: Conteo Farmacia Central - Octubre"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                autoFocus
              />
            </div>

            {/* Auditor y Tipo de Conteo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Responsable
                </label>
                <input
                  type="text"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Modalidad de Conteo
                </label>
                <select
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                >
                  <option value="formal">🎯 Conteo Formal (Escáner & Auditoría)</option>
                  <option value="quick">⚡ Inventario Rápido (Móvil / Spot)</option>
                </select>
              </div>
            </div>

            {/* SELECCIÓN Y CARGA DE LA BASE DE DATOS */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-white flex items-center justify-between">
                <span>Base de Datos de Productos para el Conteo</span>
                <span className="text-[10px] text-cyan-400 font-normal">Detecta: id, stk-sis, producto, valor</span>
              </label>

              {/* Selector de Pestañas de Carga */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setDbSource('upload')}
                  className={`py-1.5 rounded-lg transition-all ${
                    dbSource === 'upload'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Subir Excel/CSV
                </button>
                <button
                  type="button"
                  onClick={() => setDbSource('paste')}
                  className={`py-1.5 rounded-lg transition-all ${
                    dbSource === 'paste'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
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
                  className={`py-1.5 rounded-lg transition-all ${
                    dbSource === 'demo'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Usar Demo
                </button>
              </div>

              {/* SUBIR ARCHIVO */}
              {dbSource === 'upload' && (
                <div className="space-y-2">
                  <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-2xl p-4 text-center cursor-pointer transition-colors relative bg-slate-950/60">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-7 h-7 text-cyan-400 mx-auto mb-1.5" />
                    <span className="text-xs font-bold text-white block">
                      {fileName ? fileName : 'Selecciona o arrastra el archivo Excel (.xlsx / .csv)'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Detecta automáticamente: 1. ID ➔ 2. Stk-Sis ➔ 3. Producto ➔ 4. Valor Total Caja
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
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold transition-colors"
                  >
                    Interpretar Datos Pegados
                  </button>
                </div>
              )}

              {/* USAR BASE DEMO */}
              {dbSource === 'demo' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <span className="font-bold text-white block">8 Artículos de Muestra Farmacéuticos</span>
                  <p className="text-[11px] text-slate-400">
                    Incluye medicamentos con factores de empaque (ej. x30, x10, x50), códigos de barra y costos para realizar pruebas inmediatas sin subir archivo.
                  </p>
                </div>
              )}

              {/* Resumen en vivo de detección */}
              {parsedItems.length > 0 && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>{parsedItems.length} productos detectados</strong> (con factor y valor por caja).
                    </span>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-emerald-400">
                    {parsedItems.filter((i) => i.boxCost > 0).length} valorizados
                  </span>
                </div>
              )}

              {parseError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>

            {/* BOTONES DE CREACIÓN */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-600/30 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting
                  ? 'Importando y Creando...'
                  : sessionType === 'quick'
                  ? 'Crear e Ir a Inventario Rápido'
                  : 'Crear y Comenzar Conteo Formal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
