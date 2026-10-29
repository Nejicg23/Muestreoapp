import { runServerDiagnostics } from '@/app/actions/sync';
import ServerTestClient from './ServerTestClient';

export const dynamic = 'force-dynamic';

export default async function ServidoresPage() {
  const diagnostics = await runServerDiagnostics();

  return <ServerTestClient initialDiagnostics={diagnostics} />;
}
