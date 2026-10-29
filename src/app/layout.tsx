import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import {
  Package2,
  Server,
  ClipboardList,
  Activity,
  FileSpreadsheet,
  FileText,
  Shield,
  User,
  LogOut,
  LogIn,
  Smartphone,
  Zap,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { logoutAction } from '@/app/actions/auth';

export const metadata: Metadata = {
  title: 'StockSync Pro | Control de Inventario y Conteo Físico',
  description: 'Aplicación de conteo físico, conciliación de inventario y auditoría con soporte offline.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-900 text-slate-100 font-sans">
        <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <Package2 className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
                  StockSync Pro
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                    v1.0
                  </span>
                </span>
                <p className="text-xs text-slate-400">Control de Inventarios & Conteo Físico</p>
              </div>
            </Link>

            <nav className="flex items-center gap-1.5 sm:gap-3">
              <Link
                href="/"
                className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center gap-1.5"
              >
                <ClipboardList className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Sesiones</span>
              </Link>

              <Link
                href="/inventario-rapido"
                className="px-3 py-2 rounded-lg text-xs sm:text-sm font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors flex items-center gap-1.5"
              >
                <Smartphone className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Inv. Rápido</span>
              </Link>

              <Link
                href="/reportes"
                className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Reportes</span>
              </Link>

              <Link
                href="/importar"
                className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Importar</span>
              </Link>

              <Link
                href="/servidores"
                className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center gap-1.5"
              >
                <Server className="w-4 h-4 text-emerald-400" />
                <span className="hidden md:inline">Servidores</span>
              </Link>

              {/* Botón Admin Panel (visible sólo para usuarios admin) */}
              {user?.role === 'admin' && (
                <Link
                  href="/admin"
                  className="px-3 py-2 rounded-lg text-xs sm:text-sm font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors flex items-center gap-1.5"
                >
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              )}

              {/* Usuario o Login */}
              <div className="pl-2 border-l border-slate-800 flex items-center gap-2">
                {user ? (
                  <div className="flex items-center gap-2">
                    <div className="hidden lg:block text-right">
                      <div className="text-xs font-bold text-white truncate max-w-[120px]">
                        {user.fullName}
                      </div>
                      <div className="text-[10px] text-cyan-400 font-mono capitalize">
                        {user.role}
                      </div>
                    </div>
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        title="Cerrar Sesión"
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Ingresar</span>
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-400 mb-14 md:mb-0">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>StockSync Pro — Sistema de Conteo Físico y Auditoría Farmacéutica</span>
            <span className="font-mono text-slate-400">PostgreSQL • Drizzle ORM • Dexie Offline Sync</span>
          </div>
        </footer>

        {/* BARRA DE NAVEGACIÓN MÓVIL INFERIOR */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 border-t border-slate-800 backdrop-blur-xl px-2 py-2 flex items-center justify-around no-print shadow-2xl">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 text-[10px] text-slate-400 hover:text-white px-2 py-1"
          >
            <ClipboardList className="w-4 h-4 text-cyan-400" />
            <span>Sesiones</span>
          </Link>

          <Link
            href="/inventario-rapido"
            className="flex flex-col items-center gap-1 text-[10px] text-amber-300 font-bold px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 shadow-sm"
          >
            <Smartphone className="w-4 h-4 text-amber-400" />
            <span>Rápido</span>
          </Link>

          <Link
            href="/reportes"
            className="flex flex-col items-center gap-1 text-[10px] text-slate-400 hover:text-white px-2 py-1"
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Reportes</span>
          </Link>

          {user?.role === 'admin' ? (
            <Link
              href="/admin"
              className="flex flex-col items-center gap-1 text-[10px] text-amber-400 hover:text-white px-2 py-1"
            >
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Admin</span>
            </Link>
          ) : user ? (
            <form action={logoutAction} className="flex flex-col items-center">
              <button
                type="submit"
                className="flex flex-col items-center gap-1 text-[10px] text-slate-400 hover:text-rose-400 px-2 py-1 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Salir</span>
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="flex flex-col items-center gap-1 text-[10px] text-cyan-400 hover:text-white px-2 py-1"
            >
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </Link>
          )}
        </nav>
      </body>
    </html>
  );
}
