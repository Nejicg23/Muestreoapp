import type { Metadata, Viewport } from 'next';
import './globals.css';
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
import { getCurrentUser } from '@/lib/auth';
import { logoutAction } from '@/app/actions/auth';

export const metadata: Metadata = {
  title: 'StockSync Pro | Control de Inventario y Conteo Físico',
  description:
    'Aplicación empresarial de conteo físico, conciliación de inventario y auditoría con soporte offline.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#121212',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="es" className="h-full antialiased dark">
      <body className="min-h-dvh flex flex-col bg-[#0a0a0a] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
        {/* MATERIAL DESIGN 3 TOP APP BAR */}
        <header className="sticky top-0 z-50 bg-[#121212]/95 backdrop-blur-xl border-b border-[#262626] shadow-md shadow-black/40 no-print">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
            {/* Brand Logo */}
            <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform shrink-0">
                <Package2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5 truncate">
                  <span className="truncate">StockSync Pro</span>
                  <span className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#1e1e1e] text-cyan-400 border border-[#2e2e2e] shrink-0">
                    v1.0
                  </span>
                </span>
                <p className="text-[11px] text-slate-400 hidden sm:block truncate">
                  Control de Inventarios & Auditoría
                </p>
              </div>
            </Link>

            {/* Navegación Desktop (md+) y Acciones Rápidas Móvil */}
            <nav className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {user && (
                <>
                  {/* Enlaces completos en Desktop (md+) */}
                  <div className="hidden md:flex items-center gap-1.5">
                    <Link
                      href="/"
                      className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-[#1e1e1e] transition-colors flex items-center gap-1.5"
                    >
                      <ClipboardList className="w-4 h-4 text-cyan-400" />
                      <span>Sesiones</span>
                    </Link>

                    <Link
                      href="/inventario-rapido"
                      className="px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors flex items-center gap-1.5"
                    >
                      <Smartphone className="w-4 h-4 text-amber-400" />
                      <span>Inv. Rápido</span>
                    </Link>

                    <Link
                      href="/reportes"
                      className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-[#1e1e1e] transition-colors flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span>Reportes</span>
                    </Link>

                    <Link
                      href="/importar"
                      className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-[#1e1e1e] transition-colors flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                      <span>Importar</span>
                    </Link>

                    <Link
                      href="/servidores"
                      className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-[#1e1e1e] transition-colors flex items-center gap-1.5"
                    >
                      <Server className="w-4 h-4 text-emerald-400" />
                      <span>Servidores</span>
                    </Link>

                    {user.role === 'admin' && (
                      <Link
                        href="/admin"
                        className="px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors flex items-center gap-1.5"
                      >
                        <Shield className="w-4 h-4 text-amber-400" />
                        <span>Admin</span>
                      </Link>
                    )}
                  </div>

                  {/* En móvil: acceso rápido a Servidores en barra superior */}
                  <Link
                    href="/servidores"
                    title="Diagnóstico de Servidores"
                    className="md:hidden p-2 rounded-xl bg-[#1e1e1e] border border-[#2c2c2c] text-emerald-400 hover:text-white transition-colors"
                  >
                    <Server className="w-4 h-4" />
                  </Link>
                </>
              )}

              {/* Info de Usuario y Botón Salir */}
              <div className="pl-2 border-l border-[#262626] flex items-center gap-2">
                {user ? (
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-[11px] sm:text-xs font-bold text-white truncate max-w-[95px] sm:max-w-[130px]">
                        {user.fullName}
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-cyan-400 font-mono uppercase tracking-wider">
                        {user.role}
                      </div>
                    </div>
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        title="Cerrar Sesión"
                        className="p-2 rounded-xl bg-[#1e1e1e] hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-[#2c2c2c] transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                ) : (
                  <span className="px-2.5 py-1.5 rounded-xl bg-[#1e1e1e] border border-[#2c2c2c] text-slate-300 text-[11px] font-semibold flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Acceso Seguro</span>
                  </span>
                )}
              </div>
            </nav>
          </div>
        </header>

        {/* CONTENEDOR PRINCIPAL RESPONSIVO CON ESPACIADO INFERIOR PARA MÓVILES */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-4 sm:p-6 lg:p-8 pb-24 md:pb-10">
          {children}
        </main>

        {/* FOOTER DESKTOP */}
        <footer className="hidden md:block border-t border-[#1e1e1e] bg-[#0a0a0a] py-4 text-center text-xs text-slate-400 no-print">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-2">
            <span>StockSync Pro — Sistema de Conteo Físico y Auditoría Farmacéutica</span>
            <span className="font-mono text-slate-400">
              Material Dark UI • PostgreSQL • Drizzle ORM • Dexie Offline
            </span>
          </div>
        </footer>

        {/* MATERIAL DESIGN 3 BOTTOM NAVIGATION BAR PARA MÓVILES */}
        {user && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#121212]/98 border-t border-[#262626] backdrop-blur-2xl px-1.5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] grid grid-cols-5 items-center no-print shadow-[0_-8px_30px_rgba(0,0,0,0.75)]">
            <Link
              href="/"
              className="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl text-[10px] font-medium text-slate-300 hover:text-white active:bg-[#1e1e1e] transition-colors"
            >
              <ClipboardList className="w-5 h-5 text-cyan-400" />
              <span className="truncate">Sesiones</span>
            </Link>

            <Link
              href="/inventario-rapido"
              className="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl text-[10px] font-bold text-amber-300 bg-amber-500/12 border border-amber-500/30 active:scale-95 transition-all"
            >
              <Smartphone className="w-5 h-5 text-amber-400" />
              <span className="truncate">Rápido</span>
            </Link>

            <Link
              href="/importar"
              className="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl text-[10px] font-medium text-slate-300 hover:text-white active:bg-[#1e1e1e] transition-colors"
            >
              <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
              <span className="truncate">Importar</span>
            </Link>

            <Link
              href="/reportes"
              className="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl text-[10px] font-medium text-slate-300 hover:text-white active:bg-[#1e1e1e] transition-colors"
            >
              <FileText className="w-5 h-5 text-cyan-400" />
              <span className="truncate">Reportes</span>
            </Link>

            {user.role === 'admin' ? (
              <Link
                href="/admin"
                className="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl text-[10px] font-bold text-amber-300 hover:text-white active:bg-[#1e1e1e] transition-colors"
              >
                <Shield className="w-5 h-5 text-amber-400" />
                <span className="truncate">Admin</span>
              </Link>
            ) : (
              <form action={logoutAction} className="flex flex-col items-center justify-center">
                <button
                  type="submit"
                  className="w-full flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl text-[10px] font-medium text-slate-300 hover:text-rose-400 active:bg-[#1e1e1e] cursor-pointer"
                >
                  <LogOut className="w-5 h-5 text-rose-400" />
                  <span className="truncate">Salir</span>
                </button>
              </form>
            )}
          </nav>
        )}
      </body>
    </html>
  );
}
