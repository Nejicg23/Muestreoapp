import { getSessionDetails } from '@/app/actions/sync';
import ReportClient from './ReportClient';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ReportePage({
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
          No se pudo encontrar la sesión con identificador{' '}
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

  const { session, consolidated, summary, novelties } = result.data;

  return (
    <ReportClient
      session={session}
      consolidated={consolidated}
      summary={summary}
      novelties={novelties}
    />
  );
}
