'use server';

import { db } from '@/db';
import {
  inventoryCounts,
  inventoryNovelties,
  inventoryItems,
  inventorySessions,
} from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { calculateBreakdown } from '@/lib/inventory-consolidator';
import { logLegalModification } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';

// 1. REGISTRO DE CONTEO FÍSICO REGULAR (OPERADOR)
export async function recordDirectCount(payload: {
  sessionId: string;
  itemId: string;
  inputQuantity: number;
  inputUnit: 'unit' | 'pack';
  packQuantity: number;
  locationScanned?: string | null;
  countedBy: string;
  inputMethod: 'scanner' | 'manual';
  isRecount?: boolean;
  batchNumber?: string | null;
  expirationDate?: string | null;
}) {
  try {
    const breakdown = calculateBreakdown(
      payload.inputQuantity,
      payload.inputUnit,
      payload.packQuantity
    );

    const [inserted] = await db
      .insert(inventoryCounts)
      .values({
        sessionId: payload.sessionId,
        itemId: payload.itemId,
        inputQuantity: payload.inputQuantity.toString(),
        inputUnit: payload.inputUnit,
        countedPacks: breakdown.countedPacks,
        countedLoose: breakdown.countedLoose.toString(),
        countedQuantity: breakdown.countedQuantity.toString(),
        locationScanned: payload.locationScanned || null,
        batchNumber: payload.batchNumber || null,
        expirationDate: payload.expirationDate ? new Date(payload.expirationDate) : null,
        countedBy: payload.countedBy || 'Operador',
        inputMethod: payload.inputMethod || 'scanner',
        isRecount: payload.isRecount || false,
      })
      .returning();

    if (payload.batchNumber || payload.expirationDate) {
      await db
        .update(inventoryItems)
        .set({
          batchNumber: payload.batchNumber || undefined,
          expirationDate: payload.expirationDate ? new Date(payload.expirationDate) : undefined,
        })
        .where(eq(inventoryItems.id, payload.itemId));
    }

    return {
      success: true,
      data: inserted,
      breakdown,
    };
  } catch (error: any) {
    console.error('Error al registrar conteo directo:', error);
    return { success: false, error: error.message || 'Error al guardar conteo' };
  }
}

// 2. RECONTEO / MODIFICACIÓN DE CONTEO (AUDITOR Y ADMINISTRADOR)
// Permite al auditor o administrador ajustar formalmente un conteo con justificación legal
export async function executeAuditorRecount(payload: {
  sessionId: string;
  itemId: string;
  newPacks: number; // Unidades / Cajas completas
  newLoose: number; // Fracciones sueltas
  reason: string; // Justificación legal obligatoria
  operatorOverrideName?: string;
  batchNumber?: string | null;
  expirationDate?: string | null;
}) {
  try {
    const user = await getCurrentUser();
    const effectiveRole = user?.role || 'auditor';
    const effectiveUser = user?.fullName || payload.operatorOverrideName || 'Auditor Autorizado';

    // Validación de permisos: Solo administradores y auditores
    if (user && user.role !== 'admin' && user.role !== 'auditor') {
      return {
        success: false,
        error: 'Permiso denegado. Solo Auditores y Administradores pueden autorizar reconteos.',
      };
    }

    if (!payload.reason || payload.reason.trim().length < 5) {
      return {
        success: false,
        error: 'Es obligatoria una justificación de reconteo para el registro legal de modificaciones.',
      };
    }

    // Obtener ítem
    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, payload.itemId));

    if (!item) {
      return { success: false, error: 'Producto no encontrado' };
    }

    // Obtener conteos previos para asentar el valor anterior
    const previousCounts = await db
      .select()
      .from(inventoryCounts)
      .where(
        and(
          eq(inventoryCounts.sessionId, payload.sessionId),
          eq(inventoryCounts.itemId, payload.itemId)
        )
      );

    const prevTotalFractions = previousCounts.reduce(
      (sum, c) => sum + (Number(c.countedQuantity) || 0),
      0
    );

    const safeFactor = Math.max(1, item.packQuantity || 1);
    const newTotalFractions = (payload.newPacks * safeFactor) + payload.newLoose;

    // Insertar conteo formal de reconteo
    const [insertedRecount] = await db
      .insert(inventoryCounts)
      .values({
        sessionId: payload.sessionId,
        itemId: payload.itemId,
        inputQuantity: newTotalFractions.toString(),
        inputUnit: 'unit',
        countedPacks: payload.newPacks,
        countedLoose: payload.newLoose.toString(),
        countedQuantity: newTotalFractions.toString(),
        locationScanned: item.location || null,
        batchNumber: payload.batchNumber || null,
        expirationDate: payload.expirationDate ? new Date(payload.expirationDate) : null,
        countedBy: effectiveUser,
        inputMethod: 'manual',
        isRecount: true,
        recountAuthorizedBy: effectiveUser,
      })
      .returning();

    // Desactivar bandera de reconteo pendiente si la tenía y actualizar lote/vencimiento
    await db
      .update(inventoryItems)
      .set({
        requiresRecount: false,
        batchNumber: payload.batchNumber || undefined,
        expirationDate: payload.expirationDate ? new Date(payload.expirationDate) : undefined,
      })
      .where(eq(inventoryItems.id, payload.itemId));

    // ASENTAR EN EL REGISTRO LEGAL DE MODIFICACIONES (TRAZABILIDAD LEGAL)
    await logLegalModification({
      sessionId: payload.sessionId,
      userId: effectiveUser,
      userRole: effectiveRole,
      actionType: 'recount_adjustment',
      entityType: 'inventory_counts',
      entityId: insertedRecount.id,
      itemSku: item.sku,
      itemDescription: item.description,
      previousValue: {
        totalFractions: prevTotalFractions,
        previousCountsCount: previousCounts.length,
      },
      newValue: {
        newPacks: payload.newPacks,
        newLoose: payload.newLoose,
        totalFractions: newTotalFractions,
        recountAuthorizedBy: effectiveUser,
      },
      reason: payload.reason.trim(),
    });

    return {
      success: true,
      data: insertedRecount,
      newTotalFractions,
    };
  } catch (error: any) {
    console.error('Error al ejecutar reconteo de auditor:', error);
    return { success: false, error: error.message || 'Error en reconteo' };
  }
}

// 3. MODIFICAR VALOR EN MEDIO DEL CONTEO (AUDITOR Y ADMINISTRADOR)
// Recibe el valor total por caja y lo calcula por unidad/fracción para estimar el costo
export async function updateItemCostEstimate(payload: {
  sessionId: string;
  itemId: string;
  boxCost: number; // Valor total de la caja completa
  packQuantity?: number; // Factor opcional si también se ajusta (ej: 28)
  reason: string; // Justificación legal
  operatorOverrideName?: string;
}) {
  try {
    const user = await getCurrentUser();
    const effectiveRole = user?.role || 'auditor';
    const effectiveUser = user?.fullName || payload.operatorOverrideName || 'Auditor Autorizado';

    if (user && user.role !== 'admin' && user.role !== 'auditor') {
      return {
        success: false,
        error: 'Permiso denegado. Solo Auditores y Administradores pueden modificar costos y valores.',
      };
    }

    if (!payload.reason || payload.reason.trim().length < 5) {
      return {
        success: false,
        error: 'Es obligatoria una justificación de cambio de costo para la bitácora legal.',
      };
    }

    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, payload.itemId));

    if (!item) {
      return { success: false, error: 'Producto no encontrado' };
    }

    const newFactor = Math.max(1, payload.packQuantity || item.packQuantity || 1);
    // Cálculo: Costo Fracción = Costo Caja / Factor
    const calculatedFractionCost = payload.boxCost / newFactor;

    const previousValues = {
      rawCost: item.rawCost,
      costBasis: item.costBasis,
      packQuantity: item.packQuantity,
      unitCostCalculated: item.unitCostCalculated,
    };

    const newValues = {
      rawCost: payload.boxCost.toFixed(4),
      costBasis: 'pack',
      packQuantity: newFactor,
      unitCostCalculated: calculatedFractionCost.toFixed(4),
    };

    // Actualizar en base de datos
    await db
      .update(inventoryItems)
      .set({
        rawCost: newValues.rawCost,
        costBasis: 'pack',
        packQuantity: newFactor,
        unitCostCalculated: newValues.unitCostCalculated,
      })
      .where(eq(inventoryItems.id, payload.itemId));

    // Asentar en bitácora legal inmutable
    await logLegalModification({
      sessionId: payload.sessionId,
      userId: effectiveUser,
      userRole: effectiveRole,
      actionType: 'cost_updated',
      entityType: 'inventory_items',
      entityId: item.id,
      itemSku: item.sku,
      itemDescription: item.description,
      previousValue: previousValues,
      newValue: {
        ...newValues,
        boxCost: payload.boxCost,
        estimatedFractionCost: calculatedFractionCost,
      },
      reason: payload.reason.trim(),
    });

    return {
      success: true,
      unitCostCalculated: Number(calculatedFractionCost.toFixed(4)),
      boxCost: payload.boxCost,
      packQuantity: newFactor,
    };
  } catch (error: any) {
    console.error('Error al actualizar estimación de costo por caja:', error);
    return { success: false, error: error.message || 'Error al actualizar valor' };
  }
}

// 4. REGISTRO DE NOVEDADES DEL OPERADOR
// Incluye:
// - 'cruce_mercancia': Solicitar al Administrador revisión de cruce
// - 'mal_estado_averia': Reportar mal estado / avería física
// - 'proxima_vencer': Reportar fecha próxima a vencer con lote y vencimiento
// - 'otro': Otras observaciones
export async function recordOperatorNovelty(payload: {
  sessionId: string;
  itemId: string;
  noveltyType: 'cruce_mercancia' | 'mal_estado_averia' | 'proxima_vencer' | 'otro' | string;
  quantity: number;
  batchNumber?: string | null;
  expirationDate?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
  reportedBy: string;
}) {
  try {
    const user = await getCurrentUser();
    const effectiveRole = user?.role || 'operator';
    const effectiveUser = payload.reportedBy || user?.fullName || 'Operador';

    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, payload.itemId));

    const [inserted] = await db
      .insert(inventoryNovelties)
      .values({
        sessionId: payload.sessionId,
        itemId: payload.itemId,
        noveltyType: payload.noveltyType,
        quantity: payload.quantity.toString(),
        batchNumber: payload.batchNumber || null,
        expirationDate: payload.expirationDate ? new Date(payload.expirationDate) : null,
        imageUrl: payload.imageUrl || null,
        notes: payload.notes || null,
        reportedBy: effectiveUser,
      })
      .returning();

    // Si viene imagen, también la guardamos en el ítem si no tenía
    if (payload.imageUrl) {
      await db
        .update(inventoryItems)
        .set({ imageUrl: payload.imageUrl })
        .where(eq(inventoryItems.id, payload.itemId));
    }

    // Si el operador solicita revisión de cruce, marcamos el ítem con requiresRecount para alertar a admin y auditor
    if (payload.noveltyType === 'cruce_mercancia') {
      await db
        .update(inventoryItems)
        .set({ requiresRecount: true })
        .where(eq(inventoryItems.id, payload.itemId));

      await logLegalModification({
        sessionId: payload.sessionId,
        userId: effectiveUser,
        userRole: effectiveRole,
        actionType: 'cross_check_requested',
        entityType: 'inventory_novelties',
        entityId: inserted.id,
        itemSku: item?.sku,
        itemDescription: item?.description,
        previousValue: null,
        newValue: {
          noveltyType: payload.noveltyType,
          quantity: payload.quantity,
          notes: payload.notes,
        },
        reason: `Operador solicita revisión de cruce: ${payload.notes || 'Sin nota adicional'}`,
      });
    } else {
      await logLegalModification({
        sessionId: payload.sessionId,
        userId: effectiveUser,
        userRole: effectiveRole,
        actionType: 'novelty_reported',
        entityType: 'inventory_novelties',
        entityId: inserted.id,
        itemSku: item?.sku,
        itemDescription: item?.description,
        previousValue: null,
        newValue: {
          noveltyType: payload.noveltyType,
          quantity: payload.quantity,
          batchNumber: payload.batchNumber,
          expirationDate: payload.expirationDate,
          notes: payload.notes,
        },
        reason: `Reporte de novedad: ${payload.noveltyType}`,
      });
    }

    return { success: true, data: inserted };
  } catch (error: any) {
    console.error('Error al registrar novedad de operador:', error);
    return { success: false, error: error.message || 'Error al reportar novedad' };
  }
}

// Mantener retrocompatibilidad con invocaciones previas
export async function recordDirectNovelty(payload: {
  sessionId: string;
  itemId: string;
  noveltyType: string;
  quantity: number;
  batchNumber?: string | null;
  expirationDate?: string | null;
  notes?: string | null;
  reportedBy: string;
}) {
  return await recordOperatorNovelty(payload as any);
}

export async function toggleItemRecountFlag(itemId: string, flag: boolean) {
  try {
    const [updated] = await db
      .update(inventoryItems)
      .set({ requiresRecount: flag })
      .where(eq(inventoryItems.id, itemId))
      .returning();

    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Error al actualizar bandera de reconteo:', error);
    return { success: false, error: error.message };
  }
}

// 5. ADJUNTAR O ACTUALIZAR IMAGEN / EVIDENCIA FOTOGRÁFICA DE PRODUCTO O NOVEDAD
export async function updateItemImage(itemId: string, imageUrl: string) {
  try {
    const [updated] = await db
      .update(inventoryItems)
      .set({ imageUrl })
      .where(eq(inventoryItems.id, itemId))
      .returning();

    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Error al actualizar imagen de producto:', error);
    return { success: false, error: error.message };
  }
}

export async function updateNoveltyImage(noveltyId: string, imageUrl: string) {
  try {
    const [updated] = await db
      .update(inventoryNovelties)
      .set({ imageUrl })
      .where(eq(inventoryNovelties.id, noveltyId))
      .returning();

    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Error al actualizar imagen de novedad:', error);
    return { success: false, error: error.message };
  }
}
