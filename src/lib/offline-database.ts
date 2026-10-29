import Dexie, { type Table } from 'dexie';

export interface LocalItem {
  id: string;
  sessionId: string;
  sku: string;
  barcode: string | null;
  description: string;
  systemStock: number;
  packQuantity: number;
  costBasis: string;
  rawCost: number;
  unitCostCalculated: number;
  location: string | null;
  requiresRecount: boolean;
}

export interface LocalCount {
  id?: number;
  clientUuid: string;
  sessionId: string;
  itemId: string;
  inputQuantity: number;
  inputUnit: 'unit' | 'pack';
  countedPacks: number;
  countedLoose: number;
  countedQuantity: number;
  locationScanned: string | null;
  countedBy: string;
  inputMethod: 'scanner' | 'manual';
  isRecount: boolean;
  countedAt: string;
  synced: boolean;
}

export interface LocalNovelty {
  id?: number;
  clientUuid: string;
  sessionId: string;
  itemId: string;
  noveltyType: string;
  quantity: number;
  batchNumber: string | null;
  expirationDate: string | null;
  notes: string | null;
  reportedBy: string;
  createdAt: string;
  synced: boolean;
}

export interface SessionMeta {
  sessionId: string;
  title: string;
  status: string;
  lastSyncedAt: string;
}

export class OfflineInventoryDB extends Dexie {
  items!: Table<LocalItem, string>;
  pendingCounts!: Table<LocalCount, number>;
  pendingNovelties!: Table<LocalNovelty, number>;
  sessionMeta!: Table<SessionMeta, string>;

  constructor() {
    super('StockSyncOfflineDB');
    this.version(1).stores({
      items: 'id, sessionId, sku, barcode, location',
      pendingCounts: '++id, clientUuid, sessionId, itemId, synced',
      pendingNovelties: '++id, clientUuid, sessionId, itemId, synced',
      sessionMeta: 'sessionId',
    });
  }
}

// Single instance for client side execution
export const offlineDb = typeof window !== 'undefined' ? new OfflineInventoryDB() : (null as unknown as OfflineInventoryDB);
