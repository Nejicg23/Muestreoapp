'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Users,
  ClipboardList,
  Search,
  Server,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Plus,
  Lock,
  UserCheck,
  UserX,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  AlertTriangle,
  RefreshCw,
  Hash,
  Database,
  Layers,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  createNewUserAction,
  toggleUserStatusAction,
  changeUserPasswordAction,
  unlockUserAccountAction,
  logoutAction,
} from '@/app/actions/auth';
import { executeTotalSystemWipeAction } from '@/app/actions/admin';

interface AdminData {
  currentUser: {
    id: string;
    username: string;
    fullName: string;
    role: string;
  };
  users: Array<{
    id: string;
    username: string;
    fullName: string;
    role: string;
    isActive: boolean;
    failedAttempts?: number;
    lockedUntil?: string | Date | null;
    lastLogin: string | Date | null;
    createdAt: string | Date;
  }>;
  sessions: Array<{
    id: string;
    title: string;
    status: string;
    createdBy: string;
    createdAt: string | Date;
    closedAt?: string | Date | null;
    closedHash?: string | null;
  }>;
  metrics: {
    totalSessions: number;
    activeSessions: number;
    closedSessions: number;
    totalItems: number;
    totalCounts: number;
    totalNovelties: number;
    crossCheckCount?: number;
  };
  auditLogs: Array<{
    id: string;
    sessionId: string | null;
    userId: string;
    searchQuery: string;
    searchType: string;
    resultsCount: number;
    createdAt: string | Date;
  }>;
  legalModifications?: Array<{
    id: string;
    sessionId: string | null;
    userId: string;
    userRole: string;
    actionType: string;
    entityType: string;
    entityId: string;
    itemSku: string | null;
    itemDescription: string | null;
    previousValue: any;
    newValue: any;
    reason: string;
    ipAddress: string | null;
    createdAt: string | Date;
  }>;
  crossCheckRequests?: Array<{
    id: string;
    sessionId: string;
    itemId: string | null;
    noveltyType: string;
    quantity: string | number;
    batchNumber: string | null;
    expirationDate: Date | string | null;
    notes: string | null;
    reportedBy: string;
    createdAt: Date | string;
  }>;
}

export default function AdminClient({ initialData }: { initialData: AdminData }) {
  const router = useRouter();
  const [data, setData] = useState<AdminData>(initialData);
  const [activeTab, setActiveTab] = useState<'users' | 'sessions' | 'audit' | 'legal_log' | 'cross_checks' | 'wipe'>('users');
  
  // Estado para Borrado Total del Sistema
  const [wipeConfirmation, setWipeConfirmation] = useState('');
  const [wipeReason, setWipeReason] = useState('Reinicio total para nuevo inventario y base de datos');
  const [isWiping, setIsWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipeSuccess, setWipeSuccess] = useState<string | null>(null);

  // Modal Crear Usuario
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'auditor' | 'operator'>('operator');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [userModalError, setUserModalError] = useState<string | null>(null);

  // Modal Cambiar Contraseña
  const [passwordTargetUser, setPasswordTargetUser] = useState<{
    id: string;
    username: string;
    fullName: string;
  } | null>(null);
  const [customNewPassword, setCustomNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);
  const [securityBannerMsg, setSecurityBannerMsg] = useState<string | null>(null);

  const handleExecuteWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setWipeError(null);
    setWipeSuccess(null);

    if (wipeConfirmation.trim().toUpperCase() !== 'BORRAR TODO') {
      setWipeError('Debes escribir exactamente "BORRAR TODO" en mayúsculas para confirmar.');
      return;
    }

    if (!wipeReason.trim() || wipeReason.trim().length < 5) {
      setWipeError('Ingresa una justificación legal detallada para el borrado total.');
      return;
    }

    setIsWiping(true);
    try {
      const res = await executeTotalSystemWipeAction({
        confirmationText: wipeConfirmation,
        reason: wipeReason,
      });

      if (res.success) {
        setWipeSuccess(res.message || 'Borrado total ejecutado con éxito. Redirigiendo a Onboarding...');
        setData((prev) => ({
          ...prev,
          sessions: [],
          metrics: {
            ...prev.metrics,
            totalSessions: 0,
            activeSessions: 0,
            closedSessions: 0,
            totalItems: 0,
            totalCounts: 0,
            totalNovelties: 0,
            crossCheckCount: 0,
          },
          crossCheckRequests: [],
        }));
        setTimeout(() => {
          router.push('/onboarding');
        }, 1200);
      } else {
        setWipeError(res.error || 'Error al ejecutar borrado total.');
      }
    } catch (err: any) {
      setWipeError(err.message || 'Error de conexión');
    } finally {
      setIsWiping(false);
    }
  };

  const handleToggleUser = async (userId: string) => {
    try {
      const res = await toggleUserStatusAction(userId);
      if (res.success) {
        const updatedStatus = res.isActive;
        setData((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId ? { ...u, isActive: updatedStatus, failedAttempts: 0, lockedUntil: null } : u
          ),
        }));
      } else {
        alert(res.error || 'Error al cambiar estado de usuario');
      }
    } catch (err: any) {
      alert(err.message || 'Error de comunicación');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser) return;
    setIsUpdatingPassword(true);
    setPasswordModalError(null);

    try {
      const res = await changeUserPasswordAction(passwordTargetUser.id, customNewPassword);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === passwordTargetUser.id
              ? { ...u, failedAttempts: 0, lockedUntil: null }
              : u
          ),
        }));
        setSecurityBannerMsg(
          `✅ Contraseña actualizada y protección restablecida para @${passwordTargetUser.username}`
        );
        setPasswordTargetUser(null);
        setCustomNewPassword('');
        setTimeout(() => setSecurityBannerMsg(null), 5000);
      } else {
        setPasswordModalError(res.error || 'No se pudo actualizar la contraseña');
      }
    } catch (err: any) {
      setPasswordModalError(err.message || 'Error de comunicación con el servidor');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleUnlockUser = async (userId: string, username: string) => {
    try {
      const res = await unlockUserAccountAction(userId);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId ? { ...u, failedAttempts: 0, lockedUntil: null } : u
          ),
        }));
        setSecurityBannerMsg(`🔓 Cuenta @${username} desbloqueada exitosamente.`);
        setTimeout(() => setSecurityBannerMsg(null), 5000);
      } else {
        alert(res.error || 'No se pudo desbloquear la cuenta');
      }
    } catch (err: any) {
      alert(err.message || 'Error de red');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingUser(true);
    setUserModalError(null);

    try {
      const res = await createNewUserAction({
        username: newUsername,
        fullName: newFullName,
        password: newPassword,
        role: newRole,
      });

      if (res.success) {
        const createdUser = res.user;
        setData((prev) => ({
          ...prev,
          users: [
            {
              ...createdUser,
              isActive: true,
              lastLogin: null,
              createdAt: new Date().toISOString(),
            },
            ...prev.users,
          ],
        }));
        setIsCreateUserOpen(false);
        setNewUsername('');
        setNewFullName('');
        setNewPassword('');
        setNewRole('operator');
      } else {
        setUserModalError(res.error || 'No se pudo crear el usuario');
      }
    } catch (err: any) {
      setUserModalError(err.message || 'Error del servidor');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header Material Dark */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#121212] via-[#18181b] to-[#121212] p-5 sm:p-6 rounded-3xl border border-[#2c2c2c] shadow-xl">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <Shield className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Panel de Administración</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Rol: Administrador
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              Sesión activa de <strong className="text-slate-200">{data.currentUser.fullName}</strong> (@{data.currentUser.username})
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/onboarding"
            className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-600/20"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="truncate">Onboarding</span>
          </Link>
          <Link
            href="/importar"
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="truncate">Importar</span>
          </Link>
          <Link
            href="/servidores"
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition-all"
          >
            <Server className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Diagnóstico</span>
          </Link>
          <form action={logoutAction} className="w-full sm:w-auto">
            <button
              type="submit"
              className="w-full px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Salir</span>
            </button>
          </form>
        </div>
      </div>

      {/* KPI Globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Sesiones de Inventario</span>
            <ClipboardList className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">{data.metrics.totalSessions}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
            <span className="text-emerald-400 font-semibold">{data.metrics.activeSessions} en progreso</span>
            <span>•</span>
            <span className="text-slate-400">{data.metrics.closedSessions} cerradas</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Ítems en Catálogo</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">{data.metrics.totalItems.toLocaleString()}</div>
          <div className="text-[11px] text-indigo-300 mt-1">Con factor de empaque y costo</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Conteos Registrados</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{data.metrics.totalCounts.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-300 mt-1">Capturados vía lector / teclado</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Novedades Reportadas</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">{data.metrics.totalNovelties.toLocaleString()}</div>
          <div className="text-[11px] text-amber-300 mt-1">Averías, vencimientos y reconteos</div>
        </div>
      </div>

      {/* Tabs de Navegación del Panel (Scrollable en Móvil) */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 whitespace-nowrap">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'users'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Usuarios ({data.users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'sessions'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <ClipboardList className="w-4 h-4 shrink-0" />
          <span>Sesiones ({data.sessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'audit'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Search className="w-4 h-4 shrink-0" />
          <span>Búsquedas ({data.auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('legal_log')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer border shrink-0 ${
            activeTab === 'legal_log'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'border-transparent text-amber-400/80 hover:text-amber-300 hover:bg-slate-800/50'
          }`}
        >
          <Shield className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Bitácora Legal ({data.legalModifications?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('cross_checks')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer border shrink-0 ${
            activeTab === 'cross_checks'
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
              : 'border-transparent text-rose-400/80 hover:text-rose-300 hover:bg-slate-800/50'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Cruces ({data.crossCheckRequests?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('wipe')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer border shrink-0 ${
            activeTab === 'wipe'
              ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30'
              : 'border-transparent text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
          }`}
        >
          <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Borrado Total</span>
        </button>
      </div>

      {/* CONTENIDO TAB 1: GESTIÓN DE USUARIOS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Usuarios, Contraseñas y Seguridad Anti-Fuerza Bruta</h2>
              <p className="text-xs text-slate-400">
                Cambia las contraseñas por defecto, gestiona roles y desbloquea cuentas bloqueadas tras 5 intentos fallidos.
              </p>
            </div>
            <button
              onClick={() => setIsCreateUserOpen(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-600/20 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Usuario</span>
            </button>
          </div>

          {securityBannerMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between">
              <span>{securityBannerMsg}</span>
              <button
                type="button"
                onClick={() => setSecurityBannerMsg(null)}
                className="text-emerald-400 hover:text-white ml-4"
              >
                ✕
              </button>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Usuario / Nombre</th>
                    <th className="px-5 py-3.5">Rol de Acceso</th>
                    <th className="px-5 py-3.5">Estado / Seguridad</th>
                    <th className="px-5 py-3.5">Último Login</th>
                    <th className="px-5 py-3.5 text-right">Acciones de Seguridad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {data.users.map((user) => {
                    const isLocked =
                      Boolean(user.lockedUntil) &&
                      new Date(user.lockedUntil!).getTime() > Date.now();
                    const failedCount = user.failedAttempts || 0;

                    return (
                      <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            <span>{user.fullName}</span>
                            {user.id === data.currentUser.id && (
                              <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                                Tú
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 font-mono text-[11px]">@{user.username}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              user.role === 'admin'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : user.role === 'auditor'
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {user.role === 'admin' && '👑 Administrador'}
                            {user.role === 'auditor' && '🔍 Auditor'}
                            {user.role === 'operator' && '📦 Operador'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1">
                            {isLocked ? (
                              <span className="inline-flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
                                <Lock className="w-3.5 h-3.5 text-rose-400" />
                                Bloqueado (Fuerza Bruta)
                              </span>
                            ) : user.isActive ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-rose-400 font-semibold text-[11px]">
                                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                                Inactivo
                              </span>
                            )}
                            {failedCount > 0 && !isLocked && (
                              <span className="text-[10px] text-amber-400 font-mono">
                                ⚠️ {failedCount}/5 intentos fallidos
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">
                          {user.lastLogin
                            ? new Date(user.lastLogin).toLocaleString('es-ES', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'Nunca'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {(isLocked || failedCount > 0) && (
                              <button
                                type="button"
                                onClick={() => handleUnlockUser(user.id, user.username)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer"
                              >
                                🔓 Desbloquear
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setPasswordTargetUser({
                                  id: user.id,
                                  username: user.username,
                                  fullName: user.fullName,
                                });
                                setCustomNewPassword('');
                                setPasswordModalError(null);
                              }}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Cambiar Clave</span>
                            </button>

                            {user.id !== data.currentUser.id && (
                              <button
                                type="button"
                                onClick={() => handleToggleUser(user.id)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                                  user.isActive
                                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                }`}
                              >
                                {user.isActive ? 'Desactivar' : 'Activar'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 2: SUPERVISIÓN DE SESIONES */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Sesiones de Inventario</h2>
              <p className="text-xs text-slate-400">Control de estado, firmas criptográficas y acceso a reportes elaborados.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.sessions.map((sess) => (
              <div
                key={sess.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-white text-base">{sess.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Creado por: <strong className="text-slate-300">{sess.createdBy}</strong> •{' '}
                        {new Date(sess.createdAt).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        sess.status === 'in_progress'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {sess.status === 'in_progress' ? 'En Progreso' : 'Cerrada / Sellada'}
                    </span>
                  </div>

                  {sess.closedHash && (
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 font-mono text-[10px] text-slate-300 flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Sello SHA-256: {sess.closedHash}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between gap-2">
                  <Link
                    href={`/conteo/${sess.id}`}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-all"
                  >
                    Conteo Físico
                  </Link>
                  <Link
                    href={`/sesion/${sess.id}/reporte`}
                    className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Reporte Detallado</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 3: AUDITORÍA DE BÚSQUEDAS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white">Log de Auditoría de Búsquedas en Vivo</h2>
            <p className="text-xs text-slate-400">
              Registro trazable de las consultas y códigos escaneados por los operarios en las sesiones.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {data.auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No hay búsquedas registradas en la bitácora aún.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/70 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Fecha / Hora</th>
                      <th className="px-5 py-3.5">Usuario Operador</th>
                      <th className="px-5 py-3.5">Término Consultado</th>
                      <th className="px-5 py-3.5">Tipo</th>
                      <th className="px-5 py-3.5 text-right">Resultados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {data.auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3 text-slate-400 font-mono text-[11px]">
                          {new Date(log.createdAt).toLocaleString('es-ES', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-200">{log.userId}</td>
                        <td className="px-5 py-3">
                          <code className="px-2 py-0.5 rounded bg-slate-950 text-cyan-400 font-mono border border-slate-800">
                            {log.searchQuery}
                          </code>
                        </td>
                        <td className="px-5 py-3 text-slate-400 uppercase text-[10px]">{log.searchType}</td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-emerald-400">
                          {log.resultsCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 4: BITÁCORA LEGAL DE MODIFICACIONES */}
      {activeTab === 'legal_log' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Registro Legal Inmutable de Modificaciones</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Trazabilidad Legal & Auditoría
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Historial inalterable de reconteos de auditoría, ajustes de costos y novedades reportadas con su justificación obligatoria.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {(!data.legalModifications || data.legalModifications.length === 0) ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Aún no se han registrado modificaciones formales en la bitácora legal.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3.5">Fecha / Hora</th>
                      <th className="px-4 py-3.5">Usuario / Rol</th>
                      <th className="px-4 py-3.5">Tipo de Acción</th>
                      <th className="px-4 py-3.5">Producto / SKU</th>
                      <th className="px-4 py-3.5">Valores (Anterior ➔ Nuevo)</th>
                      <th className="px-4 py-3.5">Justificación Legal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {data.legalModifications.map((mod) => (
                      <tr key={mod.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(mod.createdAt).toLocaleString('es-ES', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-bold text-white text-xs">{mod.userId}</div>
                          <span
                            className={`inline-block px-2 py-0.2 rounded-full text-[9px] font-bold border mt-0.5 ${
                              mod.userRole === 'admin'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : mod.userRole === 'auditor'
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {mod.userRole.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              mod.actionType === 'recount_adjustment'
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                : mod.actionType === 'cost_updated'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : mod.actionType === 'cross_check_requested'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {mod.actionType === 'recount_adjustment' && '🔄 Reconteo de Auditoría'}
                            {mod.actionType === 'cost_updated' && '💲 Ajuste de Costo Estimado'}
                            {mod.actionType === 'cross_check_requested' && '🔀 Revisión de Cruce'}
                            {mod.actionType === 'novelty_reported' && '⚠️ Novedad Registrada'}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="font-semibold text-white truncate">{mod.itemDescription || 'Ítem'}</div>
                          <div className="text-[10px] text-cyan-400 font-mono">SKU: {mod.itemSku || 'N/A'}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]">
                          {mod.actionType === 'recount_adjustment' && (
                            <div>
                              <span className="text-slate-400">Antes: {mod.previousValue?.totalFractions ?? 0} fracc.</span>
                              <span className="text-white block font-bold text-amber-300">
                                ➔ Ahora: {mod.newValue?.newPacks} u {mod.newValue?.newLoose} f ({mod.newValue?.totalFractions} fracc.)
                              </span>
                            </div>
                          )}
                          {mod.actionType === 'cost_updated' && (
                            <div>
                              <span className="text-slate-400">Antes: ${Number(mod.previousValue?.unitCostCalculated || 0).toFixed(4)}/f</span>
                              <span className="text-white block font-bold text-emerald-300">
                                ➔ Caja: ${mod.newValue?.boxCost} (Estimado: ${Number(mod.newValue?.estimatedFractionCost || 0).toFixed(4)}/f)
                              </span>
                            </div>
                          )}
                          {mod.actionType !== 'recount_adjustment' && mod.actionType !== 'cost_updated' && (
                            <span className="text-slate-300 truncate block max-w-[200px]">
                              {JSON.stringify(mod.newValue)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs italic">
                            &ldquo;{mod.reason}&rdquo;
                          </div>
                          {mod.ipAddress && (
                            <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                              IP: {mod.ipAddress}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 5: ALERTAS DE CRUCE DE MERCANCÍA */}
      {activeTab === 'cross_checks' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Solicitudes de Revisión de Cruce de Mercancía</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Alerta Prioritaria para Administrador
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Productos marcados por los operadores que presentan sospecha de inversión física, trueque de empaques o códigos cruzados.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {(!data.crossCheckRequests || data.crossCheckRequests.length === 0) ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No hay solicitudes de revisión de cruce pendientes por revisar.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {data.crossCheckRequests.map((req) => (
                  <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          Revisión de Cruce
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(req.createdAt).toLocaleString('es-ES', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                        <span className="text-xs text-slate-400">
                          Reportado por: <strong className="text-white">{req.reportedBy}</strong>
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 mt-2">
                        <p className="text-xs text-rose-200 font-medium">
                          <strong>Observaciones del Operador:</strong> {req.notes || 'Sin nota adicional'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Cantidad afectada en físico: <strong>{req.quantity} unidades/fracciones</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/conteo/${req.sessionId}`}
                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/20 flex items-center gap-1.5"
                      >
                        <span>Ir a la Sesión a Verificar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 6: BORRADO TOTAL DEL SISTEMA & REINICIO */}
      {activeTab === 'wipe' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Zona de Peligro Administrativa
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  Borrado Total del Sistema & Reinicio para Nueva Base de Datos
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Como el sistema es flexible, esta función restablece por completo la plataforma eliminando los inventarios y conteos anteriores para comenzar desde cero con una nueva base de datos maestra o temporal.
                </p>
              </div>
            </div>

            {/* Comparación de Impacto */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lo que se elimina */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-rose-500/30 space-y-2">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  Registros que serán eliminados irreversiblemente:
                </span>
                <ul className="text-xs text-slate-300 space-y-1.5 pl-5 list-disc">
                  <li>
                    Todas las sesiones de inventario (<strong>{data.metrics.totalSessions}</strong> sesiones)
                  </li>
                  <li>
                    Todos los productos y factores de empaque (<strong>{data.metrics.totalItems}</strong> ítems)
                  </li>
                  <li>
                    Todos los conteos físicos registrados (<strong>{data.metrics.totalCounts}</strong> conteos)
                  </li>
                  <li>
                    Todas las novedades y alertas de cruce (<strong>{data.metrics.totalNovelties}</strong> novedades)
                  </li>
                  <li>Historial de búsquedas de escáner</li>
                </ul>
              </div>

              {/* Lo que se preserva */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Garantías de seguridad preservadas:
                </span>
                <ul className="text-xs text-slate-300 space-y-1.5 pl-5 list-disc">
                  <li>
                    <strong>Cuentas de usuario autorizadas</strong>: Tu cuenta de Administrador y las cuentas del equipo permanecen activas.
                  </li>
                  <li>
                    <strong>Bitácora Legal Inmutable</strong>: Se asienta legalmente el evento de borrado con tu nombre de usuario, fecha, hora e IP.
                  </li>
                  <li>
                    Redirección automática al <strong>Asistente de Onboarding</strong> para cargar tu nueva base de datos.
                  </li>
                </ul>
              </div>
            </div>

            {/* Mensajes de feedback */}
            {wipeSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{wipeSuccess}</span>
              </div>
            )}

            {wipeError && (
              <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{wipeError}</span>
              </div>
            )}

            {/* Formulario de confirmación estricta */}
            <form onSubmit={handleExecuteWipe} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div>
                <label className="text-xs font-bold text-white block mb-1">
                  1. Justificación Legal del Borrado Total <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={wipeReason}
                  onChange={(e) => setWipeReason(e.target.value)}
                  placeholder="Ej: Inicio de nuevo ejercicio de inventario general 2026"
                  required
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white block mb-1">
                  2. Confirmación de Seguridad <span className="text-rose-400">*</span>
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Escribe exactamente <strong className="text-rose-400 font-mono">BORRAR TODO</strong> en mayúsculas para desbloquear la acción:
                </p>
                <input
                  type="text"
                  value={wipeConfirmation}
                  onChange={(e) => setWipeConfirmation(e.target.value)}
                  placeholder="Escribe BORRAR TODO"
                  required
                  className="w-full px-4 py-2.5 bg-slate-900 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-mono font-bold tracking-wider focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <Link
                  href="/onboarding"
                  className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>O ir al Asistente Onboarding sin borrar nada</span>
                </Link>

                <button
                  type="submit"
                  disabled={isWiping || wipeConfirmation.trim().toUpperCase() !== 'BORRAR TODO'}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer"
                >
                  {isWiping ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Ejecutando Borrado Total...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Ejecutar Borrado Total e Iniciar Onboarding</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateUser}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>Registrar Nuevo Usuario</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateUserOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {userModalError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {userModalError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Completo</label>
              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre de Usuario (Login)</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Ej. jperez"
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña Inicial</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 5 caracteres"
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Rol de Acceso</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              >
                <option value="operator">Operador (Conteo Físico)</option>
                <option value="auditor">Auditor (Conteo, Conciliación y Reportes)</option>
                <option value="admin">Administrador (Control Total del Sistema)</option>
              </select>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateUserOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingUser}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/30 disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingUser ? 'Guardando...' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

      {passwordTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleChangePassword}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Lock className="w-5 h-5 text-cyan-400" />
                <span>Cambiar Contraseña de Seguridad</span>
              </div>
              <button
                type="button"
                onClick={() => setPasswordTargetUser(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="text-slate-400">Actualizando credenciales para:</div>
              <div className="font-bold text-white text-sm mt-0.5">
                {passwordTargetUser.fullName}{' '}
                <span className="text-cyan-400 font-mono">(@{passwordTargetUser.username})</span>
              </div>
            </div>

            {passwordModalError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {passwordModalError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nueva Contraseña Segura
              </label>
              <input
                type="password"
                value={customNewPassword}
                onChange={(e) => setCustomNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
                autoFocus
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Se encriptará con PBKDF2-SHA512 (10,000 iteraciones) y reiniciará cualquier bloqueo por intentos fallidos.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasswordTargetUser(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/30 disabled:opacity-50 cursor-pointer"
              >
                {isUpdatingPassword ? 'Encriptando...' : 'Guardar Nueva Contraseña'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
