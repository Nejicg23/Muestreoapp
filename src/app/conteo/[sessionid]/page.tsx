import { getSessionDetails, seedSampleSessionData } from '@/app/actions/sync';
import { getCurrentUser } from '@/lib/auth';
import CountingClient from './CountingClient';
import Link from 'next/link';
import { ArrowLeft, PlusCircle, AlertCircle } from 'lucide-react';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function ConteoPage({
  params,
}: {
  params: Promise<{ sessionid: string }>;
}) {
  const { sessionid } = await params;
  const result = await getSessionDetails(sessionid);

  if (!result.success || !result.data) {
    return (
      <div className="max-w-xl mx-auto my-16 bg-slate-800/80 border border-slate-700 rounded-2xl p-8 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Sesión no encontrada</h2>
        <p className="text-sm text-slate-400">
          No se pudo encontrar la sesión de inventario con identificador{' '}
          <span className="font-mono text-cyan-400">{sessionid}</span>.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Sesiones
        </Link>
      </div>
    );
  }

  const { session, items, counts } = result.data;

  // Si la sesión no tiene productos cargados, ofrecer botón de carga rápida demo
  if (items.length === 0) {
    async function handleSeedDemo() {
      'use server';
      await seedSampleSessionData(sessionid);
      revalidatePath(`/conteo/${sessionid}`);
    }

    return (
      <div className="max-w-xl mx-auto my-16 bg-slate-800/80 border border-slate-700 rounded-2xl p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center mx-auto text-cyan-400">
          <PlusCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">
            Sesión sin catálogo de productos
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Esta sesión está activa pero aún no tiene artículos cargados. Puedes sembrar productos de prueba con factores de empaque y códigos de barra para probar el sistema de inmediato.
          </p>
        </div>

        <form action={handleSeedDemo}>
          <button
            type="submit"
            className="w-full py-3 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/25 transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Cargar 8 Productos de Prueba (Con Códigos y Empaques)
          </button>
        </form>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al listado
        </Link>
      </div>
    );
  }

  const currentUser = await getCurrentUser();

  return (
    <CountingClient
      session={session}
      initialItems={items}
      initialCounts={counts}
      currentUser={currentUser}
    />
  );
}
