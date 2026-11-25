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
      {/* Encabezado Industrial */}
      <div className="bg-[#141416] p-5 sm:p-7 rounded-2xl border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white/[0.05] text-white flex items-center justify-center border border-white/[0.08]">
              <FileText className="w-4 h-4 text-[#A1A1AA]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Centro de Reportes de Inventario</h1>
          </div>
          <p className="text-xs sm:text-sm text-[#A1A1AA] mt-1 max-w-2xl">
            Visualiza informes consolidados, imprime actas oficiales y exporta datos a Excel.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/importar"
            className="px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white border border-white/[0.08] flex items-center gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#A1A1AA]" />
            <span>Nueva Importación</span>
          </Link>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#141416] p-3 rounded-xl border border-white/[0.08]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título o auditor..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#111113] border border-white/[0.08] rounded-lg text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-[#71717A] hover:text-white'
            }`}
          >
            Todas ({sessions.length})
          </button>
          <button
            onClick={() => setFilter('closed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filter === 'closed'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-[#71717A] hover:text-white'
            }`}
          >
            Selladas ({sessions.filter((s) => s.status === 'closed').length})
          </button>
          <button
            onClick={() => setFilter('in_progress')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filter === 'in_progress'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-[#71717A] hover:text-white'
            }`}
          >
            En Curso ({sessions.filter((s) => s.status === 'in_progress').length})
          </button>
        </div>
      </div>

      {/* Grid de Reportes de Sesión */}
      {filteredSessions.length === 0 ? (
        <div className="p-10 text-center bg-[#141416] border border-white/[0.08] rounded-xl space-y-3">
          <FileText className="w-10 h-10 text-[#71717A] mx-auto" />
          <h3 className="text-sm font-semibold text-white">No se encontraron sesiones de reporte</h3>
          <p className="text-xs text-[#71717A]">Intenta cambiar los términos de búsqueda o filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className="bg-[#141416] border border-white/[0.08] hover:border-white/20 rounded-xl p-5 transition-colors flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-white text-sm leading-snug">
                    {session.title}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 border ${
                      session.status === 'closed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                    }`}
                  >
                    {session.status === 'closed' ? 'Sellada' : 'En Curso'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-[#71717A]">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-[#71717A]" />
                    <span>Auditor: <strong className="text-[#D4D4D8] font-medium">{session.createdBy}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#71717A]" />
                    <span>
                      Fecha:{' '}
                      {new Date(session.createdAt).toLocaleDateString('es-ES', {
                        dateStyle: 'medium',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#A1A1AA]" />
                    <span>
                      Ítems:{' '}
                      <strong className="text-white font-mono">{session.itemsCount}</strong> productos
                    </span>
                  </div>
                </div>

                {session.closedHash && (
                  <div className="p-2 rounded-lg bg-[#111113] border border-white/[0.08] font-mono text-[10px] text-emerald-400 truncate flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">SHA-256: {session.closedHash}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 mt-4 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-[#71717A] flex items-center gap-1">
                  <Printer className="w-3.5 h-3.5 text-[#71717A]" />
                  PDF / Excel
                </span>

                <Link
                  href={`/sesion/${session.id}/reporte`}
                  className="px-3 py-1.5 rounded-lg bg-white text-[#0C0C0E] hover:bg-[#E4E4E7] text-xs font-semibold flex items-center gap-1.5 transition-colors"
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
