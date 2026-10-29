'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  UserCheck,
  Smartphone,
  Database,
  Upload,
  FileSpreadsheet,
  Layers,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  FileText,
  Check,
  Plus,
  Lock,
  User,
  Info,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import {
  parseExcelBuffer,
  parseCSVText,
  ParsedInventoryItem,
} from '@/lib/inventory-importer';
import { initializeOnboardingDatabaseAction } from '@/app/actions/admin';
import { createNewUserAction } from '@/app/actions/auth';

interface ExistingUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

interface Props {
  currentUser: {
    id: string;
    username: string;
    fullName: string;
    role: string;
  };
  existingUsers: ExistingUser[];
}

// 8 Artículos de Muestra Farmacéuticos para Base Temporal
const SAMPLE_PHARMA_DATABASE = [
  {
    sku: 'MED-1001',
    description: 'Paracetamol 500mg Tab x20',
    packQuantity: 20,
    systemStock: 45, // 2u 5f
    boxCost: 8.50,
    unitCostCalculated: 0.425,
    location: 'Estante A-1',
  },
  {
    sku: 'MED-1002',
    description: 'Ibuprofeno 400mg Caps x30',
    packQuantity: 30,
    systemStock: 60, // 2u 0f
    boxCost: 12.00,
    unitCostCalculated: 0.40,
    location: 'Estante A-2',
  },
  {
    sku: 'MED-1003',
    description: 'Amoxicilina 500mg Caps x10',
    packQuantity: 10,
    systemStock: 25, // 2u 5f
    boxCost: 6.80,
    unitCostCalculated: 0.68,
    location: 'Estante B-1',
  },
  {
    sku: 'MED-1004',
    description: 'Exforge Hct Comx5/160/12.5Mgx28',
    packQuantity: 28,
    systemStock: 61, // 2u 5f
    boxCost: 44.80,
    unitCostCalculated: 1.60,
    location: 'Refrigerado R-1',
  },
  {
    sku: 'MED-1005',
    description: 'Losartan Potasico 50mg Tab x30',
    packQuantity: 30,
    systemStock: 90, // 3u 0f
    boxCost: 15.00,
    unitCostCalculated: 0.50,
    location: 'Estante B-2',
  },
  {
    sku: 'MED-1006',
    description: 'Omeprazol 20mg Caps x14',
    packQuantity: 14,
    systemStock: 35, // 2u 7f
    boxCost: 7.70,
    unitCostCalculated: 0.55,
    location: 'Estante C-1',
  },
  {
    sku: 'MED-1007',
    description: 'Cetirizina 10mg Tab x10',
    packQuantity: 10,
    systemStock: 18, // 1u 8f
    boxCost: 4.50,
    unitCostCalculated: 0.45,
    location: 'Estante C-2',
  },
  {
    sku: 'MED-1008',
    description: 'Azitromicina 500mg Tab x3',
    packQuantity: 3,
    systemStock: 15, // 5u 0f
    boxCost: 9.90,
    unitCostCalculated: 3.30,
    location: 'Estante D-1',
  },
];

export default function OnboardingClient({ currentUser, existingUsers }: Props) {
  const router = useRouter();

  // Paso actual (1: Roles, 2: Base de Datos, 3: Modalidad & Arranque)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Rol enfocado para visualización de detalles
  const [selectedRolePreview, setSelectedRolePreview] = useState<'admin' | 'auditor' | 'operator'>('operator');

  // Modal para agregar usuario rápido en paso 1
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'auditor' | 'operator'>('operator');
  const [userList, setUserList] = useState<ExistingUser[]>(existingUsers);

  // Paso 2: Configuración de Base de Datos
  const [dbType, setDbType] = useState<'master' | 'sample'>('master');
  const [inputMode, setInputMode] = useState<'upload' | 'paste' | 'sample'>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedInventoryItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Paso 3: Modalidad de Conteo
  const [sessionType, setSessionType] = useState<'formal' | 'quick'>('formal');
  const [sessionTitle, setSessionTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manejador de subida de archivos
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
        if (!sessionTitle) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          setSessionTitle(`Inventario - ${cleanName}`);
        }
      }
    } catch (err: any) {
      setParseError('Error al leer el archivo: ' + (err.message || 'Formato no soportado'));
    }
  };

  // Manejador de texto pegado
  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;
    setParseError(null);
    try {
      const items = parseCSVText(pastedText);
      if (items.length === 0) {
        setParseError('No se pudieron extraer columnas reconocidas del texto.');
      } else {
        setParsedItems(items);
        if (!sessionTitle) {
          setSessionTitle(`Inventario Pegado - ${new Date().toLocaleDateString('es-ES')}`);
        }
      }
    } catch (err: any) {
      setParseError('Error al procesar texto: ' + err.message);
    }
  };

  // Crear usuario rápido en paso 1
  const handleCreateQuickUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createNewUserAction({
        username: newUsername,
        fullName: newFullName,
        password: newPassword,
        role: newUserRole,
      });

      if (res.success && res.user) {
        setUserList((prev) => [
          ...prev,
          {
            id: res.user.id,
            username: res.user.username,
            fullName: res.user.fullName,
            role: res.user.role,
            isActive: true,
          },
        ]);
        setIsAddUserOpen(false);
        setNewUsername('');
        setNewFullName('');
        setNewPassword('');
      } else if (!res.success) {
        alert(res.error || 'Error al crear usuario');
      }
    } catch (err: any) {
      alert(err.message || 'Error del servidor');
    }
  };

  // Enviar inicialización final
  const handleFinishOnboarding = async () => {
    let itemsToInitialize: any[] = [];

    if (dbType === 'sample' && inputMode === 'sample') {
      itemsToInitialize = SAMPLE_PHARMA_DATABASE;
    } else {
      if (parsedItems.length === 0) {
        alert('Debes cargar o pegar productos para inicializar la base de datos.');
        setStep(2);
        return;
      }
      itemsToInitialize = parsedItems.map((p) => ({
        sku: p.sku,
        description: p.description,
        systemStock: p.calculatedStock,
        packQuantity: p.factor,
        boxCost: p.boxCost,
        unitCostCalculated: p.unitCostCalculated,
        location: 'Bodega Principal',
      }));
    }

    setIsSubmitting(true);
    try {
      const res = await initializeOnboardingDatabaseAction({
        databaseType: dbType,
        sessionTitle:
          sessionTitle.trim() ||
          (dbType === 'master' ? 'Base Maestra General' : 'Base Temporal de Muestreo'),
        sessionType,
        createdBy: currentUser.fullName,
        items: itemsToInitialize,
      });

      if (res.success && res.redirectUrl) {
        router.push(res.redirectUrl);
      } else {
        alert(res.error || 'Error al inicializar el inventario.');
      }
    } catch (err: any) {
      alert(err.message || 'Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Encabezado del Asistente */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white shadow-xl shadow-cyan-600/25 shrink-0">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Asistente de Inicialización
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                Comenzar Nuevo Inventario
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Configura los roles de tu equipo y elige el tipo de base de datos para comenzar.
              </p>
            </div>
          </div>

          <Link
            href="/admin"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold self-start sm:self-auto border border-slate-700 transition-colors"
          >
            Ir al Panel Admin
          </Link>
        </div>

        {/* Indicador de Pasos (Stepper) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`p-3 rounded-2xl border text-left transition-all ${
              step === 1
                ? 'bg-cyan-500/15 border-cyan-500/40 text-white shadow-lg shadow-cyan-500/10'
                : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span className="text-[10px] font-mono font-bold uppercase block text-cyan-400">Paso 1</span>
            <span className="text-xs sm:text-sm font-bold block mt-0.5">Roles & Equipo</span>
          </button>

          <button
            type="button"
            onClick={() => setStep(2)}
            className={`p-3 rounded-2xl border text-left transition-all ${
              step === 2
                ? 'bg-cyan-500/15 border-cyan-500/40 text-white shadow-lg shadow-cyan-500/10'
                : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span className="text-[10px] font-mono font-bold uppercase block text-cyan-400">Paso 2</span>
            <span className="text-xs sm:text-sm font-bold block mt-0.5">Base de Datos</span>
          </button>

          <button
            type="button"
            onClick={() => setStep(3)}
            className={`p-3 rounded-2xl border text-left transition-all ${
              step === 3
                ? 'bg-cyan-500/15 border-cyan-500/40 text-white shadow-lg shadow-cyan-500/10'
                : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span className="text-[10px] font-mono font-bold uppercase block text-cyan-400">Paso 3</span>
            <span className="text-xs sm:text-sm font-bold block mt-0.5">Modalidad & Inicio</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PASO 1: ROLES DE USUARIOS CON DESCRIPTIVOS DETALLADOS                      */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">1. Arquitectura de Roles y Responsabilidades</h2>
              <p className="text-xs text-slate-400 mt-1">
                El sistema asigna permisos específicos según las normas de auditoría y la bitácora legal:
              </p>
            </div>

            {/* Tarjetas Comparativas de los 3 Roles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ROL 1: ADMINISTRADOR */}
              <div
                onClick={() => setSelectedRolePreview('admin')}
                className={`p-5 rounded-3xl border transition-all cursor-pointer space-y-3 relative ${
                  selectedRolePreview === 'admin'
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Control Total
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">Administrador</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supervisión suprema, gobernanza legal y control total del inventario.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Borrado total del sistema y reinicio</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Resolución de alertas de cruce de mercancía</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Bitácora Legal inmutable obligatoria</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Creación y desactivación de usuarios</span>
                  </div>
                </div>
              </div>

              {/* ROL 2: AUDITOR */}
              <div
                onClick={() => setSelectedRolePreview('auditor')}
                className={`p-5 rounded-3xl border transition-all cursor-pointer space-y-3 relative ${
                  selectedRolePreview === 'auditor'
                    ? 'bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                    Conciliador
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">Auditor</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Control de calidad, rectificación de valores y recuento formal.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>Ejecutar Re-conteos sobre ítems cerrados</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>Modificar costo total por caja ($)</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>Recálculo automático de costo por fracción</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>Firma oficial de actas de inventario</span>
                  </div>
                </div>
              </div>

              {/* ROL 3: OPERADOR */}
              <div
                onClick={() => setSelectedRolePreview('operator')}
                className={`p-5 rounded-3xl border transition-all cursor-pointer space-y-3 relative ${
                  selectedRolePreview === 'operator'
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Campo Móvil
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">Operador</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Conteo físico directo en estantería y reporte de incidencias.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Conteo de Cajas (u) y Fracciones (f)</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Uso del módulo móvil de Inventario Rápido</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Reporte de Cruces de Mercancía</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Registro de averías y fechas de vencimiento</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Listado de Cuentas Activas y Opción de Agregar Usuario */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Cuentas Disponibles en el Sistema ({userList.length})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    El sistema incluye cuentas preconfiguradas (admin, auditor, operador) o puedes agregar nuevas.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Agregar Cuenta</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {userList.map((u) => (
                  <div
                    key={u.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-white block truncate">{u.fullName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">@{u.username}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${
                        u.role === 'admin'
                          ? 'bg-amber-500/20 text-amber-300'
                          : u.role === 'auditor'
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Botón Siguiente */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-3.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
            >
              <span>Continuar a la Selección de Base de Datos</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 2: ELECCIÓN DE BASE DE DATOS (MAESTRA VS TEMPORAL / MUESTREO)         */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">2. Elección de la Base de Datos</h2>
              <p className="text-xs text-slate-400 mt-1">
                ¿Qué tipo de base de datos deseas inicializar para esta operación?
              </p>
            </div>

            {/* Selector de Tipo de Base */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* OPCIÓN 1: BASE MAESTRA */}
              <div
                onClick={() => {
                  setDbType('master');
                  if (inputMode === 'sample') setInputMode('upload');
                }}
                className={`p-5 rounded-3xl border transition-all cursor-pointer space-y-2 relative ${
                  dbType === 'master'
                    ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/15'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    Catálogo Completo
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">Base de Datos Maestra</h3>
                <p className="text-xs text-slate-400">
                  Ideal para cargar el inventario general completo (cientos o miles de productos) de la farmacia o almacén central.
                </p>
              </div>

              {/* OPCIÓN 2: BASE PEQUEÑA TEMPORAL */}
              <div
                onClick={() => setDbType('sample')}
                className={`p-5 rounded-3xl border transition-all cursor-pointer space-y-2 relative ${
                  dbType === 'sample'
                    ? 'bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/15'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                    Muestreo Rápido
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">Base Pequeña / Temporal</h3>
                <p className="text-xs text-slate-400">
                  Ideal para pruebas inmediatas, muestreos de alta rotación o auditorías por lote sin necesidad de un archivo grande.
                </p>
              </div>
            </div>

            {/* Selector de Pestañas de Carga */}
            <div className="space-y-4 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Método de Ingreso de Datos</span>
                <span className="text-[10px] text-cyan-400 font-mono">
                  Detecta: 1. ID ➔ 2. Stk-Sis ➔ 3. Producto (xN) ➔ 4. Valor Caja ($)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setInputMode('upload')}
                  className={`py-2 rounded-xl transition-all ${
                    inputMode === 'upload'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Subir Excel / CSV
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('paste')}
                  className={`py-2 rounded-xl transition-all ${
                    inputMode === 'paste'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pegar Filas de Texto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('sample');
                    setDbType('sample');
                  }}
                  className={`py-2 rounded-xl transition-all ${
                    inputMode === 'sample'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Catálogo Muestra (8 Ítems)
                </button>
              </div>

              {/* SUBIR ARCHIVO */}
              {inputMode === 'upload' && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-2xl p-6 text-center cursor-pointer relative bg-slate-950/60 transition-colors">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                    <span className="text-xs font-bold text-white block">
                      {fileName || 'Arrastra o selecciona el archivo Excel (.xlsx / .xls / .csv)'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      El sistema interpreta automáticamente las cantidades del sistema (ej: 2u5f), factores y valor monetario.
                    </span>
                  </div>
                </div>
              )}

              {/* PEGAR FILAS */}
              {inputMode === 'paste' && (
                <div className="space-y-3">
                  <textarea
                    placeholder="Pega las filas copiadas desde Excel o CSV (ID, Stk-Sis, Producto, Valor)..."
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    rows={4}
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-2xl text-white text-xs font-mono outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold transition-colors border border-slate-700"
                  >
                    Interpretar Texto Pegado
                  </button>
                </div>
              )}

              {/* CATÁLOGO DE MUESTRA FARMACÉUTICO */}
              {inputMode === 'sample' && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      8 Productos Farmacéuticos Listos para Conteo
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      Factor y Costo Configurados
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Incluye medicamentos con diferentes presentaciones (x10, x14, x20, x28, x30, x3) con stock teórico y valorización preconfigurados para pruebas inmediatas.
                  </p>
                </div>
              )}

              {/* RESUMEN DE PRODUCTOS DETECTADOS */}
              {parsedItems.length > 0 && inputMode !== 'sample' && (
                <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center justify-between text-emerald-300 font-bold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {parsedItems.length} productos procesados correctamente
                    </span>
                    <span className="font-mono text-[11px]">
                      {parsedItems.filter((i) => i.boxCost > 0).length} valorizados
                    </span>
                  </div>
                </div>
              )}

              {parseError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Botones de Navegación */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Roles</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (inputMode !== 'sample' && parsedItems.length === 0) {
                  alert('Por favor carga un archivo, pega los datos o selecciona el catálogo de muestra.');
                  return;
                }
                setStep(3);
              }}
              className="px-6 py-3.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
            >
              <span>Continuar a Modalidad de Arranque</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 3: MODALIDAD DE CONTEO & CONFIRMACIÓN FINAL                           */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">3. Modalidad de Arranque & Confirmación</h2>
              <p className="text-xs text-slate-400 mt-1">
                Elige cómo iniciará la operación tu equipo con esta nueva base de datos:
              </p>
            </div>

            {/* Selector de Modalidad */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* MODALIDAD A: CONTEO FORMAL */}
              <div
                onClick={() => setSessionType('formal')}
                className={`p-5 rounded-3xl border transition-all cursor-pointer space-y-2 relative ${
                  sessionType === 'formal'
                    ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/15'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    Auditoría Completa
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">Conteo Formal Integral</h3>
                <p className="text-xs text-slate-400">
                  Para bodegas y tiendas con escáner de código de barras, reporte formal de novedades, re-conteos autorizados y actas de cierre.
                </p>
              </div>

              {/* MODALIDAD B: INVENTARIO RÁPIDO */}
              <div
                onClick={() => setSessionType('quick')}
                className={`p-5 rounded-3xl border transition-all cursor-pointer space-y-2 relative ${
                  sessionType === 'quick'
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/15'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Móvil / Spot Check
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">Inventario Rápido Móvil</h3>
                <p className="text-xs text-slate-400">
                  Para terminales móviles o PDT. El operador elige los ítems a contar, ingresa las cantidades de su sistema externo y realiza el conteo in situ.
                </p>
              </div>
            </div>

            {/* Título de la Sesión */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold text-white block">
                Nombre o Identificador del Inventario
              </label>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Ej: Inventario General Bodega Central - Octubre 2026"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-white text-xs focus:ring-2 focus:ring-cyan-500 outline-none"
              />
            </div>

            {/* Resumen Final de Configuración */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
                Resumen de Configuración
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Tipo de Base</span>
                  <strong className="text-white">
                    {dbType === 'master' ? 'Base Maestra' : 'Base Temporal'}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Total Productos</span>
                  <strong className="text-cyan-400 font-mono">
                    {inputMode === 'sample' ? SAMPLE_PHARMA_DATABASE.length : parsedItems.length} ítems
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Modalidad</span>
                  <strong className="text-white">
                    {sessionType === 'formal' ? 'Conteo Formal' : 'Inventario Rápido'}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Responsable</span>
                  <strong className="text-slate-200">{currentUser.fullName}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de Navegación Final */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Base de Datos</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleFinishOnboarding}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-sm flex items-center gap-2 shadow-xl shadow-emerald-600/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Inicializando Base de Datos...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Inicializar Sistema y Comenzar Inventario</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* MODAL CREAR USUARIO RÁPIDO */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateQuickUser}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Agregar Cuenta al Equipo</h2>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Ej: Carlos Silva"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Nombre de Usuario (Login)</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Ej: csilva"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Contraseña Inicial</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 5 caracteres"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Rol de Acceso</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none"
                >
                  <option value="operator">Operador (Conteo Físico e Inventario Rápido)</option>
                  <option value="auditor">Auditor (Reconteo, Precios y Conciliación)</option>
                  <option value="admin">Administrador (Control Total)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                Guardar Usuario
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
