import { db } from '@/db';
import { auditModifications } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

let isTableReady = false;

export async function ensureAuditModificationsTable() {
  if (isTableReady) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_modifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES inventory_sessions(id) ON DELETE CASCADE,
        user_id VARCHAR(100) NOT NULL,
        user_role VARCHAR(30) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        item_sku VARCHAR(100),
        item_description TEXT,
        previous_value JSONB,
        new_value JSONB,
        reason TEXT NOT NULL,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    isTableReady = true;
  } catch (err) {
    console.error('Error al inicializar tabla audit_modifications:', err);
  }
}

export interface LegalModificationPayload {
  sessionId?: string;
  userId: string;
  userRole: 'admin' | 'auditor' | 'operator';
  actionType:
    | 'recount_adjustment'
    | 'cost_updated'
    | 'factor_updated'
    | 'novelty_reported'
    | 'cross_check_requested'
    | 'session_closed'
    | 'system_wipe'
    | 'onboarding_database_initialization';
  entityType: 'inventory_counts' | 'inventory_items' | 'inventory_novelties' | 'inventory_sessions' | 'system';
  entityId: string;
  itemSku?: string;
  itemDescription?: string;
  previousValue?: any;
  newValue?: any;
  reason: string;
  ipAddress?: string;
}

// Registro legal inmutable de modificaciones
export async function logLegalModification(payload: LegalModificationPayload) {
  try {
    await ensureAuditModificationsTable();
    const [record] = await db
      .insert(auditModifications)
      .values({
        sessionId: payload.sessionId,
        userId: payload.userId,
        userRole: payload.userRole,
        actionType: payload.actionType,
        entityType: payload.entityType,
        entityId: payload.entityId,
        itemSku: payload.itemSku,
        itemDescription: payload.itemDescription,
        previousValue: payload.previousValue,
        newValue: payload.newValue,
        reason: payload.reason,
        ipAddress: payload.ipAddress || '127.0.0.1',
      })
      .returning();
    return { success: true, record };
  } catch (err: any) {
    console.error('Error al asentar registro legal de modificación:', err);
    return { success: false, error: err.message };
  }
}

// Obtener bitácora legal de modificaciones
export async function getLegalModifications(limit: number = 50, sessionId?: string) {
  try {
    await ensureAuditModificationsTable();
    let query = db.select().from(auditModifications);
    if (sessionId) {
      query = query.where(eq(auditModifications.sessionId, sessionId)) as any;
    }
    return await query.orderBy(desc(auditModifications.createdAt)).limit(limit);
  } catch (err: any) {
    console.error('Error al obtener bitácora legal:', err);
    return [];
  }
}
