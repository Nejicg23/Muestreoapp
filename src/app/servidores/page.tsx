import { runServerDiagnostics } from '@/app/actions/sync';
import { requireAuth } from '@/lib/auth';
import ServerTestClient from './ServerTestClient';

export const dynamic = 'force-dynamic';

export default async function ServidoresPage() {
  await requireAuth();
  const diagnostics = await runServerDiagnostics();

  return <ServerTestClient initialDiagnostics={diagnostics} />;
}
