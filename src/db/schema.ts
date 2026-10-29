import {
    pgTable,
    uuid,
    varchar,
    text,
    numeric,
    timestamp,
    jsonb,
    integer,
    boolean,
    index,
} from 'drizzle-orm/pg-core';

// 1. SESIÓN DE INVENTARIO
export const inventorySessions = pgTable('inventory_sessions', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 150 }).notNull(),
    status: varchar('status', { length: 30 }).default('in_progress').notNull(),
    createdBy: varchar('created_by', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedHash: varchar('closed_hash', { length: 64 }),
});

// 2. SNAPSHOT TEÓRICO (Factor de Empaque y Costos)
export const inventoryItems = pgTable(
    'inventory_items',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        sessionId: uuid('session_id')
            .references(() => inventorySessions.id, { onDelete: 'cascade' })
            .notNull(),
        sku: varchar('sku', { length: 100 }).notNull(),
        barcode: varchar('barcode', { length: 100 }),
        description: text('description').notNull(),
        systemStock: numeric('system_stock', { precision: 12, scale: 2 }).default('0').notNull(),

        // Factor de empaque (ej: 30 unidades por caja)
        packQuantity: integer('pack_quantity').default(1).notNull(),
        costBasis: varchar('cost_basis', { length: 20 }).default('unit').notNull(),
        rawCost: numeric('raw_cost', { precision: 12, scale: 4 }).default('0').notNull(),
        unitCostCalculated: numeric('unit_cost_calculated', { precision: 12, scale: 4 }).default('0').notNull(),

        location: varchar('location', { length: 100 }),
        batchNumber: varchar('batch_number', { length: 50 }),
        expirationDate: timestamp('expiration_date', { mode: 'date' }),
        imageUrl: text('image_url'),
        rawMetadata: jsonb('raw_metadata'),
        requiresRecount: boolean('requires_recount').default(false).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('session_sku_idx').on(table.sessionId, table.sku),
        index('session_barcode_idx').on(table.sessionId, table.barcode),
        index('session_desc_idx').on(table.sessionId, table.description),
    ]
);

// 3. CONTEO FÍSICO (Con desglose automático de cajas y fracciones)
export const inventoryCounts = pgTable(
    'inventory_counts',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        sessionId: uuid('session_id')
            .references(() => inventorySessions.id, { onDelete: 'cascade' })
            .notNull(),
        itemId: uuid('item_id')
            .references(() => inventoryItems.id, { onDelete: 'cascade' })
            .notNull(),

        // Lo que ingresó el operador en la UI
        inputQuantity: numeric('input_quantity', { precision: 12, scale: 2 }).notNull(),
        inputUnit: varchar('input_unit', { length: 20 }).default('unit').notNull(), // 'unit', 'pack'

        // Desglose normalizado calculado por el sistema
        countedPacks: integer('counted_packs').default(0).notNull(), // Cajas completas (ej: 1)
        countedLoose: numeric('counted_loose', { precision: 12, scale: 2 }).default('0').notNull(), // Fracciones (ej: 20)
        countedQuantity: numeric('counted_quantity', { precision: 12, scale: 2 }).notNull(), // Total base (ej: 50)

        locationScanned: varchar('location_scanned', { length: 100 }),
        batchNumber: varchar('batch_number', { length: 50 }),
        expirationDate: timestamp('expiration_date', { mode: 'date' }),
        imageUrl: text('image_url'),
        countedBy: varchar('counted_by', { length: 100 }).notNull(),
        inputMethod: varchar('input_method', { length: 30 }).default('scanner').notNull(),
        isRecount: boolean('is_recount').default(false).notNull(),
        recountAuthorizedBy: varchar('recount_authorized_by', { length: 100 }),
        countedAt: timestamp('counted_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('counts_session_item_idx').on(table.sessionId, table.itemId),
    ]
);

// 4. REGISTRO DE NOVEDADES
export const inventoryNovelties = pgTable('inventory_novelties', {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
        .references(() => inventorySessions.id, { onDelete: 'cascade' })
        .notNull(),
    itemId: uuid('item_id').references(() => inventoryItems.id, { onDelete: 'cascade' }),
    noveltyType: varchar('novelty_type', { length: 50 }).notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(),
    batchNumber: varchar('batch_number', { length: 50 }),
    expirationDate: timestamp('expiration_date', { mode: 'date' }),
    imageUrl: text('image_url'),
    notes: text('notes'),
    reportedBy: varchar('reported_by', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. AUDITORÍA DE BÚSQUEDAS
export const auditSearchLogs = pgTable(
    'audit_search_logs',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        sessionId: uuid('session_id').references(() => inventorySessions.id, { onDelete: 'cascade' }),
        userId: varchar('user_id', { length: 100 }).notNull(),
        searchQuery: text('search_query').notNull(),
        searchType: varchar('search_type', { length: 30 }).default('barcode').notNull(),
        resultsCount: integer('results_count').notNull(),
        ipAddress: varchar('ip_address', { length: 45 }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('audit_session_idx').on(table.sessionId),
    ]
);


// 6. USUARIOS DEL SISTEMA Y CONTROL DE ACCESO
export const appUsers = pgTable('app_users', {
    id: uuid('id').defaultRandom().primaryKey(),
    username: varchar('username', { length: 50 }).notNull().unique(),
    fullName: varchar('full_name', { length: 100 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    salt: varchar('salt', { length: 64 }).notNull(),
    role: varchar('role', { length: 30 }).default('operator').notNull(), // 'admin' | 'auditor' | 'operator'
    isActive: boolean('is_active').default(true).notNull(),
    failedAttempts: integer('failed_attempts').default(0).notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLogin: timestamp('last_login', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});


// 7. REGISTRO LEGAL DE MODIFICACIONES Y TRAZABILIDAD (AUDIT TRAIL)
export const auditModifications = pgTable(
    'audit_modifications',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        sessionId: uuid('session_id').references(() => inventorySessions.id, { onDelete: 'cascade' }),
        userId: varchar('user_id', { length: 100 }).notNull(),
        userRole: varchar('user_role', { length: 30 }).notNull(), // 'admin' | 'auditor' | 'operator'
        actionType: varchar('action_type', { length: 50 }).notNull(), // 'recount_adjustment', 'cost_updated', 'factor_updated', 'novelty_reported', 'cross_check_requested'
        entityType: varchar('entity_type', { length: 50 }).notNull(), // 'inventory_counts', 'inventory_items', 'inventory_novelties'
        entityId: varchar('entity_id', { length: 100 }).notNull(),
        itemSku: varchar('item_sku', { length: 100 }),
        itemDescription: text('item_description'),
        previousValue: jsonb('previous_value'),
        newValue: jsonb('new_value'),
        reason: text('reason').notNull(),
        ipAddress: varchar('ip_address', { length: 45 }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
        index('audit_mod_session_idx').on(table.sessionId),
        index('audit_mod_entity_idx').on(table.entityType, table.entityId),
    ]
);
