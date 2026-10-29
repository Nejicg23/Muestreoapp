'use server';

import { db } from '@/db';
import {
  inventorySessions,
  inventoryItems,
  inventoryCounts,
  inventoryNovelties,
  auditSearchLogs,
  appUsers,
  auditModifications,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { logLegalModification } from '@/lib/audit';
import { sql, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export interface SystemWipeResult {
  success: boolean;
  error?: string;
  sessionsDeleted?: number;
  message?: string;
}

/**
 * Ejecuta el borrado total del sistema (Wipe completo)
 * Requiere confirmación estricta y rol de Administrador.
 * Mantiene la cuenta del administrador actual y registra el evento en la bitácora legal.
 */
export async function executeTotalSystemWipeAction(payload: {
  confirmationText: string;
  reason: string;
}): Promise<SystemWipeResult> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return {
        success: false,
        error: 'Permiso denegado: Solo el Administrador principal puede ejecutar el borrado total del sistema.',
      };
    }

    const cleanConfirmation = payload.confirmationText?.trim().toUpperCase();
    if (cleanConfirmation !== 'BORRAR TODO') {
      return {
        success: false,
        error: 'Palabra de confirmación inválida. Debes escribir exactamente "BORRAR TODO".',
      };
    }

    if (!payload.reason || payload.reason.trim().length < 5) {
      return {
        success: false,
        error: 'Debes proporcionar una justificación legal detallada para el borrado total.',
      };
    }

    // 1. Contar sesiones existentes para el registro
    const [countRow] = await db.execute(sql`SELECT count(*) as total FROM inventory_sessions`);
    const totalSessionsBefore = Number((countRow as any)?.total || 0);

    // 2. Ejecutar borrado en cascada
    // Al borrar inventory_sessions, PostgreSQL borra por cascada: items, counts y novelties
    await db.delete(inventoryNovelties);
    await db.delete(inventoryCounts);
    await db.delete(inventoryItems);
    await db.delete(inventorySessions);
    await db.delete(auditSearchLogs);

    // 3. Registrar el evento en la Bitácora Legal Inmutable
    await logLegalModification({
      sessionId: undefined,
      userId: user.username,
      userRole: 'admin',
      actionType: 'system_wipe',
      entityType: 'system',
      entityId: 'global_database',
      itemSku: undefined,
      itemDescription: 'REINICIO TOTAL DE SISTEMA Y BASE DE DATOS',
      previousValue: {
        totalSessionsDeleted: totalSessionsBefore,
      },
      newValue: {
        status: 'system_cleared',
        wipedAt: new Date().toISOString(),
        initiatedBy: `${user.fullName} (${user.username})`,
      },
      reason: payload.reason.trim(),
    });

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/reportes');
    revalidatePath('/inventario-rapido');

    return {
      success: true,
      sessionsDeleted: totalSessionsBefore,
      message: `Borrado total ejecutado con éxito. Se eliminaron ${totalSessionsBefore} sesiones de inventario y sus registros asociados.`,
    };
  } catch (error: any) {
    console.error('Error al ejecutar borrado total del sistema:', error);
    return {
      success: false,
      error: error.message || 'Error del servidor al ejecutar el borrado total.',
    };
  }
}

export interface OnboardingInitPayload {
  databaseType: 'master' | 'sample';
  sessionTitle: string;
  sessionType: 'formal' | 'quick';
  createdBy: string;
  items: Array<{
    sku: string;
    description: string;
    systemStock: number;
    packQuantity: number;
    boxCost: number;
    unitCostCalculated: number;
    location?: string;
  }>;
}

export interface OnboardingInitResult {
  success: boolean;
  sessionId?: string;
  redirectUrl?: string;
  error?: string;
}

/**
 * Inicializa la nueva base de datos desde el asistente de Onboarding
 */
export async function initializeOnboardingDatabaseAction(
  payload: OnboardingInitPayload
): Promise<OnboardingInitResult> {
  try {
    const user = await getCurrentUser();
    const effectiveUser = user?.fullName || payload.createdBy || 'Administrador';

    if (!payload.items || payload.items.length === 0) {
      return {
        success: false,
        error: 'No hay productos para inicializar la base de datos.',
      };
    }

    const title =
      payload.sessionTitle?.trim() ||
      (payload.databaseType === 'master'
        ? `Base Maestra General - ${new Date().toLocaleDateString('es-ES')}`
        : `Base Temporal de Muestreo - ${new Date().toLocaleDateString('es-ES')}`);

    // 1. Crear la sesión inicial
    const [newSession] = await db
      .insert(inventorySessions)
      .values({
        title,
        status: 'in_progress',
        createdBy: effectiveUser,
      })
      .returning();

    // 2. Insertar los ítems
    const itemsToInsert = payload.items.map((i) => ({
      sessionId: newSession.id,
      sku: i.sku,
      barcode: null,
      description: i.description,
      systemStock: i.systemStock.toString(),
      packQuantity: Math.max(1, i.packQuantity || 1),
      costBasis: 'pack',
      rawCost: (i.boxCost || 0).toString(),
      unitCostCalculated: (i.unitCostCalculated || 0).toString(),
      location: i.location || (payload.databaseType === 'master' ? 'Almacén Central' : 'Zona Temporal'),
    }));

    // Inserción en bloques de 100 para alta eficiencia
    const chunkSize = 100;
    for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
      const chunk = itemsToInsert.slice(i, i + chunkSize);
      await db.insert(inventoryItems).values(chunk);
    }

    // 3. Registrar en bitácora legal
    await logLegalModification({
      sessionId: newSession.id,
      userId: effectiveUser,
      userRole: user?.role || 'admin',
      actionType: 'onboarding_database_initialization',
      entityType: 'inventory_sessions',
      entityId: newSession.id,
      previousValue: null,
      newValue: {
        databaseType: payload.databaseType,
        sessionType: payload.sessionType,
        totalItems: payload.items.length,
        title,
      },
      reason: `Inicialización de Base de Datos (${payload.databaseType.toUpperCase()}) mediante Onboarding`,
    });

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/inventario-rapido');

    const redirectUrl =
      payload.sessionType === 'quick'
        ? `/inventario-rapido?sessionId=${newSession.id}`
        : `/conteo/${newSession.id}`;

    return {
      success: true,
      sessionId: newSession.id,
      redirectUrl,
    };
  } catch (error: any) {
    console.error('Error al inicializar base de datos de onboarding:', error);
    return {
      success: false,
      error: error.message || 'Error al inicializar la base de datos',
    };
  }
}
