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
  defaultTab?: 'home' | 'quick' | 'formal' | 'admin';
  onTabChange?: (tab: 'home' | 'quick' | 'formal' | 'admin') => void;
}

export default function BottomNav({
  defaultTab = 'home',
  onTabChange,
}: BottomNavProps) {
  const [activeTab, setActiveTab] = React.useState<'home' | 'quick' | 'formal' | 'admin'>(
    defaultTab
  );

  const handleTabSelect = (tab: 'home' | 'quick' | 'formal' | 'admin') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 border-t border-slate-800/50 backdrop-blur-sm shadow-lg">
      <div className="max-w-7xl mx-auto px-2 flex items-center justify-around h-16">
        {/* Inicio / Dashboard */}
        <Link
          href="/"
          onClick={() => handleTabSelect('home')}
          className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            activeTab === 'home'
              ? 'text-cyan-400 bg-cyan-500/20 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
          }`}
          aria-label="Inicio"
        >
          <Package2 className="w-4 h-4 mb-1" />
          <span className="text-[10px] text-slate-400 block">Inicio</span>
        </Link>

        {/* Inventario Rápido */}
        <Link
          href="/inventario-rapido"
          onClick={() => handleTabSelect('quick')}
          className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            activeTab === 'quick'
              ? 'text-cyan-400 bg-cyan-500/20 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
          }`}
          aria-label="Inventario Rápido"
        >
          <Smartphone className="w-4 h-4 mb-1" />
          <span className="text-[10px] text-slate-400 block">Inventario Rápido</span>
        </Link>

        {/* Conteo Formal */}
        <Link
          href="/"
          onClick={() => handleTabSelect('formal')}
          className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            activeTab === 'formal'
              ? 'text-cyan-400 bg-cyan-500/20 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
          }`}
          aria-label="Conteo Formal"
        >
          <FileSpreadsheet className="w-4 h-4 mb-1" />
          <span className="text-[10px] text-slate-400 block">Conteo Formal</span>
        </Link>

        {/* Administración */}
        <Link
          href="/admin"
          onClick={() => handleTabSelect('admin')}
          className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            activeTab === 'admin'
              ? 'text-cyan-400 bg-cyan-500/20 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
          }`}
          aria-label="Panel de Administración"
        >
          <Shield className="w-4 h-4 mb-1" />
          <span className="text-[10px] text-slate-400 block">Admin</span>
        </Link>
      </div>
    </nav>
  );
}