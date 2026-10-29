import { getInventorySessions } from '@/app/actions/sync';
import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const result = await getInventorySessions();
  const sessions = result.success && result.data ? result.data : [];

  return <HomeClient initialSessions={sessions as any} />;
}
