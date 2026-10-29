import { getSessionDetails } from '@/app/actions/sync';
import { verifyPublicReportToken } from '@/lib/auth';
import ReportClient from '@/app/sesion/[sessionid]/reporte/ReportClient';
import { ShieldAlert, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Informe Oficial de Inventario en Línea | StockSync Pro',
  description: 'Vista pública verificada y detallada del acta de conciliación de inventario respaldada en Supabase.',
};

export default async function PublicSharedReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionid: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { sessionid } = await params;
  const { key } = (await searchParams) || {};

  // Verificar firma criptográfica del enlace compartido
  if (!verifyPublicReportToken(sessionid, key)) {
    return (
      <div className="max-w-lg mx-auto my-16 bg-[#121212] border border-[#2c2c2c] rounded-3xl p-8 text-center space-y-4 shadow-2xl">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Enlace de Informe No Válido</h2>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          La firma de seguridad de este enlace público es inválida o está incompleta. Solicita el enlace oficial o el archivo PDF original al auditor responsable.
        </p>
      </div>
    );
  }

  // Obtener datos consolidados en vivo desde Supabase PostgreSQL
  const result = await getSessionDetails(sessionid);

  if (!result.success || !result.data) {
    return (
      <div className="max-w-lg mx-auto my-16 bg-[#121212] border border-[#2c2c2c] rounded-3xl p-8 text-center space-y-4 shadow-2xl">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Informe No Encontrado</h2>
        <p className="text-xs sm:text-sm text-slate-400">
          No se encontró la sesión de inventario solicitada en la base de datos.
        </p>
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
      shareToken={key}
      isPublicView={true}
    />
  );
}
