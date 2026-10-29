'use server';

import { db } from '@/db';
import {
  inventorySessions,
  inventoryItems,
  inventoryCounts,
  inventoryNovelties,
} from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { logLegalModification } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';

export interface QuickCountItemInput {
  originalItemId: string;
  sku: string;
  barcode: string | null;
  description: string;
  packQuantity: number;
  unitCost: number;
  boxCost?: number;
  location?: string | null;
  batchNumber?: string | null;
  expirationDate?: string | null;
  imageUrl?: string | null;
  // Stock que el usuario divisa en su sistema externo (ERP / POS / WMS)
  externalPacks: number;
  externalLoose: number;
  // Conteo físico real verificado en estantería
  countedPacks: number;
  countedLoose: number;
  // Novedad opcional
  hasNovelty?: boolean;
  noveltyType?: string;
  noveltyNotes?: string;
}

export interface QuickInventoryPayload {
  sourceSessionId?: string;
  auditTitle?: string;
  auditDate?: string;
  operatorName: string;
  reason?: string;
  items: QuickCountItemInput[];
}

export async function getExistingSessionsForQuickAudit() {
  try {
    const sessions = await db
      .select({
        id: inventorySessions.id,
        title: inventorySessions.title,
        status: inventorySessions.status,
        createdAt: inventorySessions.createdAt,
      })
      .from(inventorySessions)
      .orderBy(desc(inventorySessions.createdAt));

    return { success: true, sessions };
  } catch (err: any) {
    return { success: false, error: err.message, sessions: [] };
  }
}

export async function getItemsBySession(sessionId: string) {
  try {
    const items = await db
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
      .orderBy(inventoryItems.description);

    return { success: true, items };
  } catch (err: any) {
    return { success: false, error: err.message, items: [] };
  }
}

// Procesa y asienta formalmente el Inventario Rápido con Trazabilidad Legal
export async function submitQuickInventoryAudit(payload: QuickInventoryPayload) {
  try {
    const user = await getCurrentUser();
    const effectiveUser = user?.fullName || payload.operatorName || 'Operador Móvil';
    const effectiveRole = user?.role || 'operator';

    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: 'Debes seleccionar al menos un ítem para realizar el inventario rápido.' };
    }

    const sessionTitle =
      payload.auditTitle?.trim() ||
      `Inventario Rápido - ${new Date().toLocaleDateString('es-ES')} (${payload.items.length} ítems)`;

    // 1. Crear sesión de auditoría rápida formal
    const auditCreatedAt = payload.auditDate ? new Date(payload.auditDate) : new Date();
    const [newSession] = await db
      .insert(inventorySessions)
      .values({
        title: sessionTitle,
        status: 'closed', // Se sella formalmente al completar
        createdBy: effectiveUser,
        createdAt: auditCreatedAt,
      })
      .returning();

    let totalTheoreticalFractions = 0;
    let totalPhysicalFractions = 0;
    let totalSurplusFractions = 0;
    let totalShortageFractions = 0;
    let matchedCount = 0;

    const auditSummaryItems: any[] = [];

    // 2. Insertar ítems y conteos físicos
    for (const itemInput of payload.items) {
      const factor = Math.max(1, itemInput.packQuantity || 1);

      // Total teórico declarado según el sistema externo del usuario
      const theoreticalFractions = (itemInput.externalPacks * factor) + itemInput.externalLoose;
      // Total físico contado realmente
      const physicalFractions = (itemInput.countedPacks * factor) + itemInput.countedLoose;

      const diff = physicalFractions - theoreticalFractions;

      totalTheoreticalFractions += theoreticalFractions;
      totalPhysicalFractions += physicalFractions;

      if (diff === 0) {
        matchedCount++;
      } else if (diff > 0) {
        totalSurplusFractions += diff;
      } else {
        totalShortageFractions += Math.abs(diff);
      }

      const rawCostVal = itemInput.boxCost !== undefined && itemInput.boxCost > 0
        ? itemInput.boxCost.toString()
        : ((itemInput.unitCost || 0) * factor).toString();
      const unitCostVal = itemInput.unitCost > 0
        ? itemInput.unitCost.toString()
        : (itemInput.boxCost ? (itemInput.boxCost / factor).toFixed(4) : '0');

      // Insertar ítem en la nueva sesión
      const [createdItem] = await db
        .insert(inventoryItems)
        .values({
          sessionId: newSession.id,
          sku: itemInput.sku,
          barcode: itemInput.barcode || null,
          description: itemInput.description,
          systemStock: theoreticalFractions.toString(),
          packQuantity: factor,
          costBasis: 'unit',
          rawCost: rawCostVal,
          unitCostCalculated: unitCostVal,
          location: itemInput.location || null,
          batchNumber: itemInput.batchNumber || null,
          expirationDate: itemInput.expirationDate ? new Date(itemInput.expirationDate) : null,
          imageUrl: itemInput.imageUrl || null,
          requiresRecount: diff !== 0,
        })
        .returning();

      // Insertar conteo físico oficial
      await db.insert(inventoryCounts).values({
        sessionId: newSession.id,
        itemId: createdItem.id,
        inputQuantity: physicalFractions.toString(),
        inputUnit: 'unit',
        countedPacks: itemInput.countedPacks,
        countedLoose: itemInput.countedLoose.toString(),
        countedQuantity: physicalFractions.toString(),
        locationScanned: itemInput.location || null,
        batchNumber: itemInput.batchNumber || null,
        expirationDate: itemInput.expirationDate ? new Date(itemInput.expirationDate) : null,
        imageUrl: itemInput.imageUrl || null,
        countedBy: effectiveUser,
        inputMethod: 'manual',
        isRecount: false,
      });

      // Si el ítem original en la base maestra no tenía costo, vencimiento o imagen, actualizarlo
      if (itemInput.originalItemId && (Number(unitCostVal) > 0 || itemInput.batchNumber || itemInput.expirationDate || itemInput.imageUrl)) {
        await db.update(inventoryItems).set({
          rawCost: Number(rawCostVal) > 0 ? rawCostVal : undefined,
          unitCostCalculated: Number(unitCostVal) > 0 ? unitCostVal : undefined,
          batchNumber: itemInput.batchNumber || undefined,
          expirationDate: itemInput.expirationDate ? new Date(itemInput.expirationDate) : undefined,
          imageUrl: itemInput.imageUrl || undefined,
        }).where(eq(inventoryItems.id, itemInput.originalItemId));
      }

      // Si tiene novedad reportada
      if (itemInput.hasNovelty && itemInput.noveltyType) {
        await db.insert(inventoryNovelties).values({
          sessionId: newSession.id,
          itemId: createdItem.id,
          noveltyType: itemInput.noveltyType,
          quantity: (itemInput.countedLoose || 1).toString(),
          batchNumber: itemInput.batchNumber || null,
          expirationDate: itemInput.expirationDate ? new Date(itemInput.expirationDate) : null,
          imageUrl: itemInput.imageUrl || null,
          notes: itemInput.noveltyNotes || 'Reporte en inventario rápido móvil',
          reportedBy: effectiveUser,
        });
      }

      auditSummaryItems.push({
        sku: itemInput.sku,
        description: itemInput.description,
        factor,
        externalStockDeclared: `${itemInput.externalPacks} u ${itemInput.externalLoose} f (${theoreticalFractions} fracc.)`,
        physicalCounted: `${itemInput.countedPacks} u ${itemInput.countedLoose} f (${physicalFractions} fracc.)`,
        diffFractions: diff,
        isMatched: diff === 0,
      });
    }

    // 3. Generar Sello Criptográfico SHA-256 de Cierre
    const hashData = JSON.stringify({
      sessionId: newSession.id,
      operator: effectiveUser,
      role: effectiveRole,
      itemsCount: payload.items.length,
      theoreticalTotal: totalTheoreticalFractions,
      physicalTotal: totalPhysicalFractions,
      timestamp: new Date().toISOString(),
    });
    const closedHash = crypto.createHash('sha256').update(hashData).digest('hex');

    await db
      .update(inventorySessions)
      .set({
        closedAt: new Date(),
        closedHash,
      })
      .where(eq(inventorySessions.id, newSession.id));

    // 4. Asentar en la Bitácora Legal de Modificaciones
    await logLegalModification({
      sessionId: newSession.id,
      userId: effectiveUser,
      userRole: effectiveRole,
      actionType: 'recount_adjustment',
      entityType: 'inventory_sessions',
      entityId: newSession.id,
      previousValue: null,
      newValue: {
        totalItems: payload.items.length,
        totalTheoreticalFractions,
        totalPhysicalFractions,
        matchedCount,
        discrepantCount: payload.items.length - matchedCount,
        closedHash,
        itemsSummary: auditSummaryItems,
      },
      reason: payload.reason?.trim() || 'Inventario Rápido Móvil / Muestreo Cíclico Formal',
    });

    return {
      success: true,
      sessionId: newSession.id,
      closedHash,
      summary: {
        totalItems: payload.items.length,
        matchedCount,
        discrepantCount: payload.items.length - matchedCount,
        totalTheoreticalFractions,
        totalPhysicalFractions,
        accuracyPercentage: Math.round((matchedCount / payload.items.length) * 100),
      },
    };
  } catch (error: any) {
    console.error('Error al procesar inventario rápido:', error);
    return { success: false, error: error.message || 'Error en auditoría rápida' };
  }
}
