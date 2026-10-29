import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAdminDashboardData } from '@/app/actions/auth';
import AdminClient from './AdminClient';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Panel de Administración | StockSync Pro',
  description: 'Control de usuarios, sesiones y auditoría global de inventarios.',
};

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Acceso Restringido</h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md">
          Esta sección requiere permisos de <strong className="text-amber-400">Administrador</strong>.
          Tu usuario actual ({user.fullName}) cuenta con rol de <strong className="text-cyan-400">{user.role}</strong>.
        </p>
        <div className="pt-2 flex items-center gap-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Inicio
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white"
          >
            Iniciar con otra cuenta
          </Link>
        </div>
      </div>
    );
  }

  const res = await getAdminDashboardData();
  if (!res.success || !res.data) {
    return (
      <div className="p-8 text-center text-rose-400">
        Error al cargar los datos del panel administrativo: {res.error}
      </div>
    );
  }

  return <AdminClient initialData={res.data} />;
}
