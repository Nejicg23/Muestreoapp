import { db } from '@/db';
import { inventorySessions, inventoryItems, masterProducts } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import QuickInventoryClient from './QuickInventoryClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Inventario Rápido & Reporte de Novedades | StockSync Pro',
  description: 'Módulo móvil de muestreo rápido y reporte de novedades con validez legal.',
};

interface PageProps {
  searchParams: Promise<{ sessionId?: string; mode?: string }>;
}

export default async function InventarioRapidoPage({ searchParams }: PageProps) {
  const { sessionId, mode } = (await searchParams) || {};
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

  const targetSessionId = sessionId || (sessions.length > 0 ? sessions[0].id : '');

  if (targetSessionId) {
    initialSessionId = targetSessionId;
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
        rawMetadata: inventoryItems.rawMetadata,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.sessionId, targetSessionId))
      .orderBy(inventoryItems.sku);
  }

  // Si no hay ítems en la sesión seleccionada, intentar cargar desde la base maestra
  if (items.length === 0) {
    try {
      const masters = await db
        .select({
          id: masterProducts.id,
          sku: masterProducts.sku,
          barcode: masterProducts.barcode,
          description: masterProducts.description,
          packQuantity: masterProducts.packQuantity,
          boxCost: masterProducts.boxCost,
          unitCostCalculated: masterProducts.unitCostCalculated,
          location: masterProducts.location,
        })
        .from(masterProducts)
        .where(eq(masterProducts.isActive, true))
        .limit(300);

      if (masters.length > 0) {
        items = masters.map((m) => ({
          id: m.id,
          sessionId: undefined,
          sku: m.sku,
          barcode: m.barcode,
          description: m.description,
          systemStock: '0',
          packQuantity: m.packQuantity,
          rawCost: m.boxCost,
          unitCostCalculated: m.unitCostCalculated || '0',
          location: m.location || 'Bodega Principal',
        }));
      }
    } catch {}
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
      initialMode={mode as any}
    />
  );
}
