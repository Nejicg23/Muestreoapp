'use client';

import React from 'react';
import Link from 'next/link';
import {
  Package2,
  Server,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Shield,
  LogOut,
  Smartphone,
} from 'lucide-react';

interface BottomNavProps {
  onTabChange?: (tab: 'home' | 'quick' | 'formal' | 'admin' | 'reportes-novedades') => void;
}

export default function BottomNav({ onTabChange }: BottomNavProps) {
  const [activeTab, setActiveTab] = React.useState<'home' | 'quick' | 'formal' | 'admin' | 'reportes-novedades'>('home');

  const handleTabSelect = (tab: 'home' | 'quick' | 'formal' | 'admin' | 'reportes-novedades') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <nav className="flex bottom-0 left-0 right-0 border-t border-slate-800/80 bg-slate-950/95 px-4 pt-2 pb-3 sm:pt-4 pb-4">
      <div className="flex flex-col items-center justify-between w-full max-w-screenxl mx-auto">
        <div className="flex gap-2">
          {/* Inicio */}
          <Link
            href="/"
            onClick={() => handleTabSelect("home")}
            className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-all ${activeTab === "home" ? "text-cyan-400 bg-cyan-500/20 border border-cyan-500/30" : "text-slate-400 hover:text-white hover:bg-slate-800/30"}`}
            aria-label="Inicio"
          >
            <Package2 className="w-4 h-4 mb-1" />
            <span className="text-[10px] text-slate-400 block">Inicio</span>
          </Link>

          {/* Inventario Rápido */}
          <Link
            href="/inventario-rapido"
            onClick={() => handleTabSelect("quick")}
            className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-all ${activeTab === "quick" ? "text-cyan-400 bg-cyan-500/20 border border-cyan-500/30" : "text-slate-400 hover:text-white hover:bg-slate-800/30"}`}
            aria-label="Inventario Rápido"
          >
            <Smartphone className="w-4 h-4 mb-1" />
            <span className="text-[10px] text-slate-400 block">Inventario Rápido</span>
          </Link>

          {/* Conteo Formal */}
          <Link
            href="/"
            onClick={() => handleTabSelect("formal")}
            className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-all ${activeTab === "formal" ? "text-cyan-400 bg-cyan-500/20 border border-cyan-500/30" : "text-slate-400 hover:text-white hover:bg-slate-800/30"}`}
            aria-label="Conteo Formal"
          >
            <FileSpreadsheet className="w-4 h-4 mb-1" />
            <span className="text-[10px] text-slate-400 block">Conteo Formal</span>
          </Link>

          {/* Administración */}
          <Link
            href="/admin"
            onClick={() => handleTabSelect("admin")}
            className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-all ${activeTab === "admin" ? "text-cyan-400 bg-cyan-500/20 border border-cyan-500/30" : "text-slate-400 hover:text-white hover:bg-slate-800/30"}`}
            aria-label="Administración"
          >
            <Shield className="w-4 h-4 mb-1" />
            <span className="text-[10px] text-slate-400 block">Admin</span>
          </Link>

          {/* Reportes de Novedades */}
          <Link
            href="/reportes/novedades"
            onClick={() => handleTabSelect("reportes-novedades")}
            className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-all ${activeTab === "reportes-novedades" ? "text-cyan-400 bg-cyan-500/20 border border-cyan-500/30" : "text-slate-400 hover:text-white hover:bg-slate-800/30"}`}
            aria-label="Reportes de Novedades"
          >
            <ClipboardList className="w-4 h-4 mb-1" />
            <span className="text-[10px] text-slate-400 block">Novedades</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
