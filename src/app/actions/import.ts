'use server';

import { db } from '@/db';
import { inventorySessions, inventoryItems } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export interface ImportItemInput {
  sku: string;
  description: string;
  systemStock: number;
  packQuantity: number;
  boxCost?: number;
  unitCostCalculated?: number;
  location?: string;
  rawMetadata?: any;
}

export async function importInventoryItems(payload: {
  sessionId?: string;
  createNewSession?: boolean;
  newSessionTitle?: string;
  createdBy?: string;
  sessionType?: 'formal' | 'quick';
  items: ImportItemInput[];
}) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'Acceso denegado. Debes iniciar sesión para importar datos.' };
    }

    let targetSessionId = payload.sessionId;

    // 1. Crear nueva sesión si se solicitó o no hay ID
    if (payload.createNewSession || !targetSessionId) {
      const title = (payload.newSessionTitle || 'Inventario Importado').trim();
      const creator = (payload.createdBy || 'Operador de Importación').trim();

      const [newSession] = await db
        .insert(inventorySessions)
        .values({
          title,
          createdBy: creator,
          status: 'in_progress',
        })
        .returning();

      targetSessionId = newSession.id;
    }

    if (!targetSessionId) {
      return { success: false, error: 'No se especificó la sesión de inventario.' };
    }

    // 2. Preparar registros para Drizzle
    const itemsToInsert = payload.items.map((item) => {
      const safeFactor = Math.max(1, item.packQuantity || 1);
      const boxCostNum = Number(item.boxCost) || 0;
      // El valor ingresado es el total de la caja, el sistema calcula el costo por fracción estimada
      const fractionCost =
        item.unitCostCalculated !== undefined && item.unitCostCalculated > 0
          ? item.unitCostCalculated
          : boxCostNum > 0
          ? boxCostNum / safeFactor
          : 1.0;

      return {
        sessionId: targetSessionId!,
        sku: item.sku.trim(),
        barcode: item.sku.trim(), // SKU como clave de escaneo por defecto
        description: item.description.trim(),
        systemStock: item.systemStock.toString(),
        packQuantity: safeFactor,
        costBasis: 'pack' as const,
        rawCost: boxCostNum.toFixed(4), // Valor monetario en dólares del total de la caja
        unitCostCalculated: fractionCost.toFixed(4), // Costo calculado por fracción
        location: item.location || 'Bodega Principal',
        rawMetadata: item.rawMetadata || null,
        requiresRecount: false,
      };
    });

    // Inserción en bloques (chunks) de 50 para evitar exceder límites de parámetros
    const chunkSize = 50;
    let insertedCount = 0;

    for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
      const chunk = itemsToInsert.slice(i, i + chunkSize);
      await db.insert(inventoryItems).values(chunk);
      insertedCount += chunk.length;
    }

    return {
      success: true,
      sessionId: targetSessionId,
      insertedCount,
    };
  } catch (error: any) {
    console.error('Error al importar artículos en lote:', error);
    return { success: false, error: error.message || 'Error al guardar artículos' };
  }
}
