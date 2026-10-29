import { db } from '@/db';
import { inventorySessions, inventoryItems } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import QuickInventoryClient from './QuickInventoryClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Inventario Rápido Móvil | StockSync Pro',
  description: 'Módulo móvil de muestreo rápido y cotejo manual contra sistema externo con validez legal.',
};

interface PageProps {
  searchParams: Promise<{ sessionId?: string }>;
}

export default async function InventarioRapidoPage({ searchParams }: PageProps) {
  const { sessionId } = (await searchParams) || {};
  const currentUser = await requireAuth();

  // Obtener sesiones existentes con recuento de ítems
  const sessions = await db
    .select({
      id: inventorySessions.id,
      title: inventorySessions.title,
      status: inventorySessions.status,
      createdAt: inventorySessions.createdAt,
      itemCount: sql<number>`count(${inventoryItems.id})::int`,
    })
    .from(inventorySessions)
    .leftJoin(inventoryItems, eq(inventoryItems.sessionId, inventorySessions.id))
    .groupBy(inventorySessions.id)
    .orderBy(desc(inventorySessions.createdAt));

  let items: any[] = [];
  let initialSessionId = '';

  if (sessionId) {
    const sessionExists = sessions.find((s) => s.id === sessionId);
    if (sessionExists) {
      initialSessionId = sessionId;
      items = await db
        .select({
          id: inventoryItems.id,
          sessionId: inventoryItems.sessionId,
          sku: inventoryItems.sku,
          barcode: inventoryItems.barcode,
          description: inventoryItems.description,
          systemStock: inventoryItems.systemStock,
          packQuantity: inventoryItems.packQuantity,
          rawCost: inventoryItems.rawCost,
          unitCostCalculated: inventoryItems.unitCostCalculated,
          location: inventoryItems.location,
        })
        .from(inventoryItems)
        .where(eq(inventoryItems.sessionId, sessionId))
        .orderBy(inventoryItems.sku);
    }
  }

  return (
    <QuickInventoryClient
      sessions={sessions.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      }))}
      initialSessionId={initialSessionId}
      initialItems={items}
      currentUser={currentUser}
    />
  );
}
