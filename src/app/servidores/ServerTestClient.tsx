'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
  HardDrive,
  Cpu,
  ShieldCheck,
  Play,
  ArrowRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import { runServerDiagnostics, createInventorySession } from '@/app/actions/sync';
import { offlineDb } from '@/lib/offline-database';
import { useRouter } from 'next/navigation';

interface DiagnosticResult {
  success: boolean;
  totalLatencyMs: number;
  timestamp: string;
  checks: Array<{
    name: string;
    status: 'ok' | 'error' | 'warning';
    details: string;
    latencyMs?: number;
  }>;
}

export default function ServerTestClient({
  initialDiagnostics,
}: {
  initialDiagnostics: DiagnosticResult;
}) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult>(initialDiagnostics);
  const [isRunning, setIsRunning] = useState(false);
  const [dexieStatus, setDexieStatus] = useState<{
    indexedDbAvailable: boolean;
    storageEstimate?: { usage: number; quota: number };
  } | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const router = useRouter();

  // Test local Dexie storage
  const checkDexie = async () => {
    if (typeof window === 'undefined') return;
    try {
      const isAvailable = !!window.indexedDB && !!offlineDb;
      let estimate;
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        estimate = {
          usage: Math.round((est.usage || 0) / 1024 / 1024),
          quota: Math.round((est.quota || 0) / 1024 / 1024),
        };
      }
      setDexieStatus({ indexedDbAvailable: isAvailable, storageEstimate: estimate });
    } catch (e) {
      setDexieStatus({ indexedDbAvailable: false });
    }
  };

  useEffect(() => {
    checkDexie();
  }, []);

  const handleRunDiagnostics = async () => {
    setIsRunning(true);
    await checkDexie();
    const res = await runServerDiagnostics();
    setDiagnostics(res);
    setIsRunning(false);
  };

  // Crear sesión de prueba inmediata
  const handleQuickTestSession = async () => {
    setIsCreatingSession(true);
    const dateStr = new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const res = await createInventorySession({
      title: `Prueba Servidor PostgreSQL - ${dateStr}`,
      createdBy: 'Ingeniero de Pruebas',
      seedDemoItems: true,
    });

    if (res.success && res.data) {
      router.push(`/conteo/${res.data.id}`);
    } else {
      alert('Error al crear sesión: ' + res.error);
      setIsCreatingSession(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Diagnóstico y Prueba con los Servidores
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Monitoreo en vivo de conectividad con PostgreSQL, latencia de base de datos y persistencia offline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRunDiagnostics}
            disabled={isRunning}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/25 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Ejecutando pruebas...' : 'Volver a Probar Servidores'}</span>
          </button>

          <button
            onClick={handleQuickTestSession}
            disabled={isCreatingSession}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md shadow-cyan-600/25 flex items-center gap-2 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isCreatingSession ? 'Creando sesión...' : 'Crear Sesión de Prueba'}</span>
          </button>
        </div>
      </div>

      {/* Tarjeta de Estado General */}
      <div
        className={`border rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          diagnostics.success
            ? 'bg-gradient-to-r from-emerald-950/40 to-slate-900 border-emerald-700/60'
            : 'bg-gradient-to-r from-rose-950/40 to-slate-900 border-rose-700/60'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
              diagnostics.success
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}
          >
            {diagnostics.success ? (
              <CheckCircle2 className="w-8 h-8" />
            ) : (
              <AlertTriangle className="w-8 h-8" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {diagnostics.success
                ? 'Servidores y Base de Datos 100% Operativos'
                : 'Atención: Incidencia Detectada en Servidores'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Última verificación:{' '}
              {new Date(diagnostics.timestamp).toLocaleTimeString()} • Latencia total acumulada:{' '}
              <span className="font-mono text-cyan-400 font-bold">
                {diagnostics.totalLatencyMs} ms
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
              diagnostics.success
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}
          >
            {diagnostics.success ? 'HEALTHY • 200 OK' : 'ERROR EN CHEQUEOS'}
          </span>
        </div>
      </div>

      {/* Resultados de Chequeos Individuales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {diagnostics.checks.map((check, idx) => (
          <div
            key={idx}
            className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 shadow-md flex items-start gap-3 hover:border-slate-600 transition-colors"
          >
            <div className="mt-0.5 shrink-0">
              {check.status === 'ok' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-white truncate">
                  {check.name}
                </span>
                {check.latencyMs !== undefined && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-400 border border-slate-700 shrink-0">
                    {check.latencyMs} ms
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 break-words">
                {check.details}
              </p>
            </div>
          </div>
        ))}

        {/* Chequeo de Motor Offline Dexie (Cliente) */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 shadow-md flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {dexieStatus?.indexedDbAvailable ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sm text-white">
                Almacenamiento Local Offline (IndexedDB / Dexie)
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-700">
                Cliente
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {dexieStatus?.indexedDbAvailable
                ? `Activo y listo para sincronización bidireccional. ${
                    dexieStatus.storageEstimate
                      ? `Uso: ${dexieStatus.storageEstimate.usage}MB de ${dexieStatus.storageEstimate.quota}MB disponibles.`
                      : ''
                  }`
                : 'No se detectó soporte de IndexedDB en el navegador actual.'}
            </p>
          </div>
        </div>
      </div>

      {/* Arquitectura de Conexión */}
      <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-3">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          Topología y Parámetros del Servidor
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 block">Motor de Datos:</span>
            <span className="text-white font-bold mt-1 block">PostgreSQL (Drizzle ORM)</span>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 block">Modo de Pool:</span>
            <span className="text-white font-bold mt-1 block">Direct / Serverless pooling</span>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 block">Respaldo Offline:</span>
            <span className="text-emerald-400 font-bold mt-1 block">Dexie.js IndexedDB</span>
          </div>
        </div>
      </div>
    </div>
  );
}
