'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Calendar,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';

interface SessionItem {
  id: string;
  title: string;
  status: string;
  createdBy: string;
  createdAt: string | Date;
  closedAt?: string | Date | null;
  closedHash?: string | null;
  itemsCount: number;
}

export default function ReportesIndexClient({ sessions }: { sessions: SessionItem[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'closed' | 'in_progress'>('all');

  const filteredSessions = sessions.filter((s) => {
    const matchSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.createdBy.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;
    if (filter === 'closed') return s.status === 'closed';
    if (filter === 'in_progress') return s.status === 'in_progress';
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/60 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Centro de Reportes de Inventario</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Visualiza informes consolidados, imprime actas oficiales de inventario y exporta datos a Excel
            (completo o filtrado por novedades).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/importar"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-2 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            <span>Nueva Importación</span>
          </Link>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar reporte por título o auditor..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Todas ({sessions.length})
          </button>
          <button
            onClick={() => setFilter('closed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filter === 'closed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Cerradas / Selladas ({sessions.filter((s) => s.status === 'closed').length})
          </button>
          <button
            onClick={() => setFilter('in_progress')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filter === 'in_progress'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            En Curso ({sessions.filter((s) => s.status === 'in_progress').length})
          </button>
        </div>
      </div>

      {/* Grid de Reportes de Sesión */}
      {filteredSessions.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <FileText className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-white">No se encontraron sesiones de reporte</h3>
          <p className="text-xs text-slate-400">Intenta cambiar los términos de búsqueda o filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className="bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-5 transition-all shadow-lg flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-white text-base group-hover:text-cyan-400 transition-colors">
                    {session.title}
                  </h3>
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

                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Auditor: <strong className="text-slate-300">{session.createdBy}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Fecha:{' '}
                      {new Date(session.createdAt).toLocaleDateString('es-ES', {
                        dateStyle: 'medium',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      Ítems:{' '}
                      <strong className="text-white font-mono">{session.itemsCount}</strong> productos
                    </span>
                  </div>
                </div>

                {session.closedHash && (
                  <div className="p-2 rounded-xl bg-slate-950 border border-emerald-500/20 font-mono text-[10px] text-emerald-400 truncate flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">SHA-256: {session.closedHash}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  Impresión y Excel
                </span>

                <Link
                  href={`/sesion/${session.id}/reporte`}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20"
                >
                  <span>Abrir Reporte</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
