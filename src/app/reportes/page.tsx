import { db } from '@/db';
import { inventorySessions, inventoryItems, inventoryCounts } from '@/db/schema';
import { desc, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import ReportesIndexClient from './ReportesIndexClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reportes de Inventario | StockSync Pro',
  description: 'Centro de reportes consolidados, auditoría e impresión de inventarios.',
};

export default async function ReportesPage() {
  await requireAuth();
  const sessions = await db
    .select({
      id: inventorySessions.id,
      title: inventorySessions.title,
      status: inventorySessions.status,
      createdBy: inventorySessions.createdBy,
      createdAt: inventorySessions.createdAt,
      closedAt: inventorySessions.closedAt,
      closedHash: inventorySessions.closedHash,
    })
    .from(inventorySessions)
    .orderBy(desc(inventorySessions.createdAt));

  // Obtener conteo de ítems por sesión
  const itemsCountPerSession = await db.execute(
    sql`SELECT session_id, count(*) as total_items FROM inventory_items GROUP BY session_id`
  );

  const itemsMap: Record<string, number> = {};
  for (const row of itemsCountPerSession as any) {
    if (row.session_id) {
      itemsMap[row.session_id] = Number(row.total_items || 0);
    }
  }

  const enrichedSessions = sessions.map((s) => ({
    ...s,
    itemsCount: itemsMap[s.id] || 0,
  }));

  return <ReportesIndexClient sessions={enrichedSessions} />;
}
