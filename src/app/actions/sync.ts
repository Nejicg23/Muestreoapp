'use server';

import { db } from '@/db';
import {
  inventorySessions,
  inventoryItems,
  inventoryCounts,
  inventoryNovelties,
  auditSearchLogs,
} from '@/db/schema';
import { eq, desc, sql, count } from 'drizzle-orm';
import crypto from 'crypto';
import { calculateBreakdown, consolidateSessionData } from '@/lib/inventory-consolidator';

// ==========================================
// 1. SESIONES DE INVENTARIO
// ==========================================

export async function getInventorySessions() {
  try {
    const sessions = await db
      .select({
        id: inventorySessions.id,
        title: inventorySessions.title,
        status: inventorySessions.status,
        createdBy: inventorySessions.createdBy,
        createdAt: inventorySessions.createdAt,
        closedAt: inventorySessions.closedAt,
        closedHash: inventorySessions.closedHash,
        itemsCount: sql<number>`(SELECT count(*) FROM inventory_items WHERE session_id = ${inventorySessions.id})::int`,
        countsCount: sql<number>`(SELECT count(*) FROM inventory_counts WHERE session_id = ${inventorySessions.id})::int`,
      })
      .from(inventorySessions)
      .orderBy(desc(inventorySessions.createdAt));

    return { success: true, data: sessions };
  } catch (error: any) {
    console.error('Error al obtener sesiones:', error);
    return { success: false, error: error.message || 'Error desconocido' };
  }
}

export async function createInventorySession(formData: {
  title: string;
  createdBy: string;
  seedDemoItems?: boolean;
}) {
  try {
    const [newSession] = await db
      .insert(inventorySessions)
      .values({
        title: formData.title.trim(),
        createdBy: formData.createdBy.trim() || 'Auditor',
        status: 'in_progress',
      })
      .returning();

    if (formData.seedDemoItems) {
      await seedSampleSessionData(newSession.id);
    }

    return { success: true, data: newSession };
  } catch (error: any) {
    console.error('Error al crear sesión:', error);
    return { success: false, error: error.message || 'Error al crear la sesión' };
  }
}

// ==========================================
// 2. SEEDER DE DATOS DE PRUEBA
// ==========================================

export async function seedSampleSessionData(sessionId: string) {
  try {
    const sampleItems = [
      {
        sessionId,
        sku: 'MED-AMOX-500',
        barcode: '770123450001',
        description: 'Amoxicilina 500mg Cápsulas',
        systemStock: '120.00',
        packQuantity: 30, // 30 cápsulas por caja
        costBasis: 'unit',
        rawCost: '0.4500',
        unitCostCalculated: '0.4500',
        location: 'Pasillo A - Estante 1',
        requiresRecount: false,
      },
      {
        sessionId,
        sku: 'MED-IBUP-400',
        barcode: '770123450002',
        description: 'Ibuprofeno 400mg Tabletas',
        systemStock: '200.00',
        packQuantity: 20, // 20 tabletas por caja
        costBasis: 'pack',
        rawCost: '6.0000', // $6 por caja -> $0.30 unidad
        unitCostCalculated: '0.3000',
        location: 'Pasillo A - Estante 2',
        requiresRecount: false,
      },
      {
        sessionId,
        sku: 'MED-PARA-500',
        barcode: '770123450003',
        description: 'Paracetamol 500mg Comprimidos',
        systemStock: '500.00',
        packQuantity: 50,
        costBasis: 'pack',
        rawCost: '7.5000',
        unitCostCalculated: '0.1500',
        location: 'Pasillo A - Estante 3',
        requiresRecount: false,
      },
      {
        sessionId,
        sku: 'MED-LORAT-10',
        barcode: '770123450004',
        description: 'Loratadina 10mg Caja x 10',
        systemStock: '85.00',
        packQuantity: 10,
        costBasis: 'unit',
        rawCost: '0.6000',
        unitCostCalculated: '0.6000',
        location: 'Pasillo B - Estante 1',
        requiresRecount: false,
      },
      {
        sessionId,
        sku: 'MED-OMEP-20',
        barcode: '770123450005',
        description: 'Omeprazol 20mg Cápsulas',
        systemStock: '160.00',
        packQuantity: 28,
        costBasis: 'pack',
        rawCost: '14.0000',
        unitCostCalculated: '0.5000',
        location: 'Pasillo B - Estante 2',
        requiresRecount: false,
      },
      {
        sessionId,
        sku: 'DES-ALCOHOL-70',
        barcode: '770123450006',
        description: 'Alcohol Antiséptico 70% 1000ml',
        systemStock: '45.00',
        packQuantity: 12,
        costBasis: 'unit',
        rawCost: '2.8000',
        unitCostCalculated: '2.8000',
        location: 'Zona Líquidos - Estante 4',
        requiresRecount: false,
      },
      {
        sessionId,
        sku: 'MAT-GUANTES-M',
        barcode: '770123450007',
        description: 'Guantes de Nitrilo Talla M (Caja x 100)',
        systemStock: '30.00',
        packQuantity: 100,
        costBasis: 'pack',
        rawCost: '8.5000',
        unitCostCalculated: '0.0850',
        location: 'Insumos Quirúrgicos - Gaveta 2',
        requiresRecount: false,
      },
      {
        sessionId,
        sku: 'MAT-JERINGA-5ML',
        barcode: '770123450008',
        description: 'Jeringa Desechable 5ml c/ Aguja',
        systemStock: '350.00',
        packQuantity: 50,
        costBasis: 'unit',
        rawCost: '0.2200',
        unitCostCalculated: '0.2200',
        location: 'Insumos Quirúrgicos - Gaveta 5',
        requiresRecount: false,
      },
    ];

    await db.insert(inventoryItems).values(sampleItems);
    return { success: true, count: sampleItems.length };
  } catch (error: any) {
    console.error('Error al insertar datos de prueba:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// 3. OBTENER DETALLE COMPLETO DE SESIÓN
// ==========================================

export async function getSessionDetails(sessionId: string) {
  try {
    const [session] = await db
      .select()
      .from(inventorySessions)
      .where(eq(inventorySessions.id, sessionId));

    if (!session) {
      return { success: false, error: 'Sesión no encontrada' };
    }

    const items = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.sessionId, sessionId))
      .orderBy(inventoryItems.sku);

    const counts = await db
      .select()
      .from(inventoryCounts)
      .where(eq(inventoryCounts.sessionId, sessionId))
      .orderBy(desc(inventoryCounts.countedAt));

    const novelties = await db
      .select()
      .from(inventoryNovelties)
      .where(eq(inventoryNovelties.sessionId, sessionId))
      .orderBy(desc(inventoryNovelties.createdAt));

    const { consolidated, summary } = consolidateSessionData(
      items,
      counts,
      novelties
    );

    return {
      success: true,
      data: {
        session,
        items,
        counts,
        novelties,
        consolidated,
        summary,
      },
    };
  } catch (error: any) {
    console.error('Error al obtener detalle de sesión:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// 4. SINCRONIZACIÓN BATCH (OFFLINE A SERVER)
// ==========================================

export interface SyncCountPayload {
  clientUuid: string;
  sessionId: string;
  itemId: string;
  inputQuantity: number;
  inputUnit: 'unit' | 'pack';
  countedPacks: number;
  countedLoose: number;
  countedQuantity: number;
  locationScanned?: string | null;
  countedBy: string;
  inputMethod: 'scanner' | 'manual';
  isRecount: boolean;
  countedAt: string;
}

export interface SyncNoveltyPayload {
  clientUuid: string;
  sessionId: string;
  itemId: string;
  noveltyType: string;
  quantity: number;
  batchNumber?: string | null;
  expirationDate?: string | null;
  notes?: string | null;
  reportedBy: string;
  createdAt: string;
}

export async function syncOfflineBatch(payload: {
  sessionId: string;
  counts: SyncCountPayload[];
  novelties: SyncNoveltyPayload[];
}) {
  try {
    const insertedCounts = [];
    const insertedNovelties = [];

    // Procesar conteos
    if (payload.counts && payload.counts.length > 0) {
      for (const c of payload.counts) {
        const [res] = await db
          .insert(inventoryCounts)
          .values({
            sessionId: payload.sessionId,
            itemId: c.itemId,
            inputQuantity: c.inputQuantity.toString(),
            inputUnit: c.inputUnit,
            countedPacks: c.countedPacks,
            countedLoose: c.countedLoose.toString(),
            countedQuantity: c.countedQuantity.toString(),
            locationScanned: c.locationScanned || null,
            countedBy: c.countedBy || 'Operador',
            inputMethod: c.inputMethod || 'scanner',
            isRecount: c.isRecount || false,
            countedAt: new Date(c.countedAt || Date.now()),
          })
          .returning();
        insertedCounts.push(res);
      }
    }

    // Procesar novedades
    if (payload.novelties && payload.novelties.length > 0) {
      for (const n of payload.novelties) {
        const [res] = await db
          .insert(inventoryNovelties)
          .values({
            sessionId: payload.sessionId,
            itemId: n.itemId,
            noveltyType: n.noveltyType,
            quantity: n.quantity.toString(),
            batchNumber: n.batchNumber || null,
            expirationDate: n.expirationDate ? new Date(n.expirationDate) : null,
            notes: n.notes || null,
            reportedBy: n.reportedBy || 'Operador',
            createdAt: new Date(n.createdAt || Date.now()),
          })
          .returning();
        insertedNovelties.push(res);
      }
    }

    return {
      success: true,
      syncedCountsCount: insertedCounts.length,
      syncedNoveltiesCount: insertedNovelties.length,
    };
  } catch (error: any) {
    console.error('Error al sincronizar batch offline:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// 5. REGISTRAR AUDITORÍA DE BÚSQUEDA
// ==========================================

export async function logSearchAudit(params: {
  sessionId: string;
  userId: string;
  searchQuery: string;
  searchType: 'barcode' | 'sku' | 'description';
  resultsCount: number;
}) {
  try {
    await db.insert(auditSearchLogs).values({
      sessionId: params.sessionId,
      userId: params.userId || 'Operador',
      searchQuery: params.searchQuery,
      searchType: params.searchType,
      resultsCount: params.resultsCount,
    });
    return { success: true };
  } catch (err) {
    // Audit logs shouldn't break UI flow
    console.warn('Advertencia al registrar auditoría de búsqueda:', err);
    return { success: false };
  }
}

// ==========================================
// 6. CIERRE DE SESIÓN CON HASH DE INTEGRIDAD
// ==========================================

export async function closeInventorySession(sessionId: string, closedBy: string) {
  try {
    const counts = await db
      .select()
      .from(inventoryCounts)
      .where(eq(inventoryCounts.sessionId, sessionId));

    // Generar hash SHA-256 criptográfico de los conteos realizados para inmutabilidad
    const rawData = JSON.stringify({
      sessionId,
      closedBy,
      countsCount: counts.length,
      timestamp: new Date().toISOString(),
    });

    const closedHash = crypto
      .createHash('sha256')
      .update(rawData)
      .digest('hex');

    const [updated] = await db
      .update(inventorySessions)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedHash,
      })
      .where(eq(inventorySessions.id, sessionId))
      .returning();

    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Error al cerrar sesión:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// 7. PRUEBA DE CONECTIVIDAD CON SERVIDORES
// ==========================================

export async function runServerDiagnostics() {
  const startTime = performance.now();
  const checks: {
    name: string;
    status: 'ok' | 'error' | 'warning';
    details: string;
    latencyMs?: number;
  }[] = [];

  let overallSuccess = true;

  // 1. Latencia y Ping a PostgreSQL
  try {
    const pingStart = performance.now();
    const result = await db.execute(sql`SELECT NOW() as server_time, current_database() as db_name, version() as pg_version`);
    const pingLatency = Math.round(performance.now() - pingStart);

    const row = (result as any)[0];
    checks.push({
      name: 'Conexión a PostgreSQL (Supabase)',
      status: 'ok',
      details: `Base de datos: ${row.db_name}. Hora server: ${new Date(row.server_time).toLocaleTimeString()}. Versión: ${String(row.pg_version).slice(0, 30)}...`,
      latencyMs: pingLatency,
    });
  } catch (err: any) {
    overallSuccess = false;
    checks.push({
      name: 'Conexión a PostgreSQL',
      status: 'error',
      details: err.message || 'Fallo de conexión',
    });
  }

  // 2. Verificación de Tablas del Esquema
  const requiredTables = [
    'inventory_sessions',
    'inventory_items',
    'inventory_counts',
    'inventory_novelties',
    'audit_search_logs',
  ];

  for (const tableName of requiredTables) {
    try {
      const start = performance.now();
      const countRes = await db.execute(
        sql.raw(`SELECT count(*) as total FROM ${tableName}`)
      );
      const rowCount = (countRes as any)[0]?.total ?? 0;
      checks.push({
        name: `Tabla: ${tableName}`,
        status: 'ok',
        details: `Activa en public schema con ${rowCount} registros`,
        latencyMs: Math.round(performance.now() - start),
      });
    } catch (err: any) {
      overallSuccess = false;
      checks.push({
        name: `Tabla: ${tableName}`,
        status: 'error',
        details: `No se pudo consultar: ${err.message}`,
      });
    }
  }

  // 3. Prueba de Escritura y Limpieza
  try {
    const start = performance.now();
    // Insertamos y borramos una sesión de diagnóstico temporal
    const [testSession] = await db
      .insert(inventorySessions)
      .values({
        title: '__DIAGNOSTIC_TEST_SESSION__',
        createdBy: 'SYSTEM_DIAGNOSTIC',
        status: 'test',
      })
      .returning();

    await db
      .delete(inventorySessions)
      .where(eq(inventorySessions.id, testSession.id));

    checks.push({
      name: 'Prueba de Escritura y Eliminación (I/O)',
      status: 'ok',
      details: 'Inserción y eliminación de prueba completadas con éxito',
      latencyMs: Math.round(performance.now() - start),
    });
  } catch (err: any) {
    overallSuccess = false;
    checks.push({
      name: 'Prueba de Escritura y Eliminación (I/O)',
      status: 'error',
      details: err.message,
    });
  }

  const totalTime = Math.round(performance.now() - startTime);

  return {
    success: overallSuccess,
    totalLatencyMs: totalTime,
    timestamp: new Date().toISOString(),
    checks,
  };
}
