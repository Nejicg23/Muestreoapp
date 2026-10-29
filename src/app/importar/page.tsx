import { getInventorySessions } from '@/app/actions/sync';
import { requireAuth } from '@/lib/auth';
import ImportClient from './ImportClient';

export const dynamic = 'force-dynamic';

export default async function ImportarPage() {
  await requireAuth();
  const res = await getInventorySessions();
  const sessions = res.success && res.data ? res.data : [];

  const activeSessions = sessions
    .filter((s) => s.status === 'in_progress')
    .map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      createdAt: s.createdAt,
    }));

  return <ImportClient existingSessions={activeSessions} />;
}
