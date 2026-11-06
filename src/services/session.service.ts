'use server';

import { db } from '@/db';
import {
  inventorySessions,
  inventoryItems,
  inventoryCounts,
  inventoryNovelties,
  auditModifications,
} from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { logLegalModification } from '@/lib/audit';

export interface DuplicateSessionResult {
  success: boolean;
  newSessionId?: string;
  error?: string;
  itemsDuplicated?: number;
  countsDuplicated?: number;
  noveltiesDuplicated?: number;
}

/**
 * Duplica una sesión de inventario completa:
 * - Crea una nueva sesión basada en la original (estado: in_progress)
 * - Copia todos los ítems (con nuevos IDs, mapeados)
 * - Copia todos los conteos físicos asociados a esos ítems (referenciando nuevos IDs)
 * - Copia todas las novedades de la sesión
 * - Registra el evento en la bitácora legal de modificaciones
 *
 * Esta operación es útil para:
 * - Crear un nuevo ciclo de conteo basado en una sesión anterior (inventario cíclico)
 * - Probar ajustes sin modificar la sesión original sellada
 * - Reutilizar un catálogo de productos ya cargado
 */
export async function duplicateSession(
  sourceSessionId: string,
  newTitle?: string
): Promise<DuplicateSessionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'Usuario no autenticado. Debes iniciar sesión para duplicar una sesión.',
      };
    }

    // 1. Obtener sesión original
    const [sourceSession] = await db
      .select()
      .from(inventorySessions)
      .where(eq(inventorySessions.id, sourceSessionId));

    if (!sourceSession) {
      return { success: false, error: 'La sesión original no existe.' };
    }

    // 2. Obtener ítems de la sesión original
    const sourceItems = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.sessionId, sourceSessionId))
      .orderBy(inventoryItems.sku);

    if (sourceItems.length === 0) {
      return {
        success: false,
        error: 'La sesión original no tiene ítems para duplicar.',
      };
    }

    // 3. Obtener conteos y novedades de la sesión original
    const sourceCounts = await db
      .select()
      .from(inventoryCounts)
      .where(eq(inventoryCounts.sessionId, sourceSessionId))
      .orderBy(desc(inventoryCounts.countedAt));

    const sourceNovelties = await db
      .select()
      .from(inventoryNovelties)
      .where(eq(inventoryNovelties.sessionId, sourceSessionId))
      .orderBy(desc(inventoryNovelties.createdAt));

    // 4. Crear nueva sesión
    const title =
      newTitle?.trim() ||
      `Copia de ${sourceSession.title} - ${new Date().toLocaleDateString('es-ES')}`;

    const [newSession] = await db
      .insert(inventorySessions)
      .values({
        title,
        status: 'in_progress',
        createdBy: user.fullName || user.username,
        createdAt: new Date(),
      })
      .returning();

    // 5. Mapear IDs de ítems viejos -> nuevos
    const itemIdMap = new Map<string, string>();

    // Insertar ítems en bloques para no exceder límites de parámetros
    const chunkSize = 100;
    let itemsInserted = 0;

    for (let i = 0; i < sourceItems.length; i += chunkSize) {
      const chunk = sourceItems.slice(i, i + chunkSize);
      const itemsToInsert = chunk.map((item) => ({
        sessionId: newSession.id,
        sku: item.sku,
        barcode: item.barcode,
        description: item.description,
        systemStock: item.systemStock,
        packQuantity: item.packQuantity,
        costBasis: item.costBasis,
        rawCost: item.rawCost,
        unitCostCalculated: item.unitCostCalculated,
        location: item.location,
        batchNumber: item.batchNumber,
        expirationDate: item.expirationDate,
        imageUrl: item.imageUrl,
        rawMetadata: item.rawMetadata,
        requiresRecount: false, // Al duplicar, se marca como sin requerir reconteo inicial
        createdAt: new Date(),
      }));

      const inserted = await db.insert(inventoryItems).values(itemsToInsert).returning();
      for (const [index, insertedItem] of inserted.entries()) {
        const oldId = chunk[index].id;
        itemIdMap.set(oldId, insertedItem.id);
        itemsInserted++;
      }
    }

    // 6. Insertar conteos físicos referenciando los nuevos itemIds
    let countsInserted = 0;
    for (const count of sourceCounts) {
      const newItemId = itemIdMap.get(count.itemId);
      if (!newItemId) continue;

      await db.insert(inventoryCounts).values({
        sessionId: newSession.id,
        itemId: newItemId,
        inputQuantity: count.inputQuantity,
        inputUnit: count.inputUnit,
        countedPacks: count.countedPacks,
        countedLoose: count.countedLoose,
        countedQuantity: count.countedQuantity,
        locationScanned: count.locationScanned,
        batchNumber: count.batchNumber,
        expirationDate: count.expirationDate,
        imageUrl: count.imageUrl,
        countedBy: user.fullName || user.username,
        inputMethod: count.inputMethod,
        isRecount: true, // Al duplicar, los conteos se heredan como reconteos de referencia
        recountAuthorizedBy: user.username,
        countedAt: new Date(),
      });
      countsInserted++;
    }

    // 7. Insertar novedades referenciando los nuevos itemIds
    let noveltiesInserted = 0;
    for (const novelty of sourceNovelties) {
      const newItemId = novelty.itemId ? itemIdMap.get(novelty.itemId) : null;
      if (novelty.itemId && !newItemId) continue;

      await db.insert(inventoryNovelties).values({
        sessionId: newSession.id,
        itemId: newItemId,
        noveltyType: novelty.noveltyType,
        quantity: novelty.quantity,
        batchNumber: novelty.batchNumber,
        expirationDate: novelty.expirationDate,
        imageUrl: novelty.imageUrl,
        notes: novelty.notes,
        reportedBy: user.fullName || user.username,
        createdAt: new Date(),
      });
      noveltiesInserted++;
    }

    // 8. Registrar en bitácora legal
    await logLegalModification({
      sessionId: newSession.id,
      userId: user.username,
      userRole: user.role,
      actionType: 'recount_adjustment',
      entityType: 'inventory_sessions',
      entityId: newSession.id,
      previousValue: {
        sourceSessionId,
        sourceTitle: sourceSession.title,
        sourceCreatedAt: sourceSession.createdAt,
      },
      newValue: {
        duplicatedFrom: sourceSessionId,
        duplicatedAt: new Date().toISOString(),
        itemsCount: itemsInserted,
        countsCount: countsInserted,
        noveltiesCount: noveltiesInserted,
      },
      reason: `Sesión duplicada desde "${sourceSession.title}" (${sourceSessionId})`,
    });

    return {
      success: true,
      newSessionId: newSession.id,
      itemsDuplicated: itemsInserted,
      countsDuplicated: countsInserted,
      noveltiesDuplicated: noveltiesInserted,
    };
  } catch (error: any) {
    console.error('Error al duplicar sesión de inventario:', error);
    return {
      success: false,
      error: error.message || 'Error inesperado al duplicar la sesión.',
    };
  }
}
