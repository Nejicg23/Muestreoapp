'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  offlineDb,
  LocalItem,
  LocalCount,
  LocalNovelty,
} from '@/lib/offline-database';
import { syncOfflineBatch, SyncCountPayload, SyncNoveltyPayload } from '@/app/actions/sync';

export function useInventorySync(sessionId: string) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<{
    time: string;
    success: boolean;
    syncedCounts?: number;
    error?: string;
  } | null>(null);

  // Comprobar estado de conexión y elementos pendientes en Dexie
  const refreshPendingStatus = useCallback(async () => {
    if (!offlineDb) return;
    try {
      const countsPending = await offlineDb.pendingCounts
        .where('sessionId')
        .equals(sessionId)
        .and((item) => !item.synced)
        .count();

      const noveltiesPending = await offlineDb.pendingNovelties
        .where('sessionId')
        .equals(sessionId)
        .and((item) => !item.synced)
        .count();

      setPendingCount(countsPending + noveltiesPending);
    } catch (e) {
      console.warn('Error al verificar pendientes en Dexie:', e);
    }
  }, [sessionId]);

  // Sincronizar todos los datos pendientes hacia el servidor PostgreSQL
  const triggerSync = useCallback(async () => {
    if (!offlineDb || isSyncing || !navigator.onLine) return;
    setIsSyncing(true);

    try {
      const unSyncedCounts = await offlineDb.pendingCounts
        .where('sessionId')
        .equals(sessionId)
        .and((item) => !item.synced)
        .toArray();

      const unSyncedNovelties = await offlineDb.pendingNovelties
        .where('sessionId')
        .equals(sessionId)
        .and((item) => !item.synced)
        .toArray();

      if (unSyncedCounts.length === 0 && unSyncedNovelties.length === 0) {
        setIsSyncing(false);
        await refreshPendingStatus();
        return;
      }

      const countPayload: SyncCountPayload[] = unSyncedCounts.map((c) => ({
        clientUuid: c.clientUuid,
        sessionId: c.sessionId,
        itemId: c.itemId,
        inputQuantity: c.inputQuantity,
        inputUnit: c.inputUnit,
        countedPacks: c.countedPacks,
        countedLoose: c.countedLoose,
        countedQuantity: c.countedQuantity,
        locationScanned: c.locationScanned,
        countedBy: c.countedBy,
        inputMethod: c.inputMethod,
        isRecount: c.isRecount,
        countedAt: c.countedAt,
      }));

      const noveltyPayload: SyncNoveltyPayload[] = unSyncedNovelties.map((n) => ({
        clientUuid: n.clientUuid,
        sessionId: n.sessionId,
        itemId: n.itemId,
        noveltyType: n.noveltyType,
        quantity: n.quantity,
        batchNumber: n.batchNumber,
        expirationDate: n.expirationDate,
        notes: n.notes,
        reportedBy: n.reportedBy,
        createdAt: n.createdAt,
      }));

      const res = await syncOfflineBatch({
        sessionId,
        counts: countPayload,
        novelties: noveltyPayload,
      });

      if (res.success) {
        // Marcar como sincronizados en Dexie
        const countIds = unSyncedCounts.map((c) => c.id!).filter(Boolean);
        const noveltyIds = unSyncedNovelties.map((n) => n.id!).filter(Boolean);

        for (const cid of countIds) {
          await offlineDb.pendingCounts.update(cid, { synced: true });
        }
        for (const nid of noveltyIds) {
          await offlineDb.pendingNovelties.update(nid, { synced: true });
        }

        setLastSyncResult({
          time: new Date().toLocaleTimeString(),
          success: true,
          syncedCounts: (res.syncedCountsCount || 0) + (res.syncedNoveltiesCount || 0),
        });
      } else {
        setLastSyncResult({
          time: new Date().toLocaleTimeString(),
          success: false,
          error: res.error,
        });
      }
    } catch (err: any) {
      console.error('Error durante la sincronización:', err);
      setLastSyncResult({
        time: new Date().toLocaleTimeString(),
        success: false,
        error: err.message || 'Error de red',
      });
    } finally {
      setIsSyncing(false);
      await refreshPendingStatus();
    }
  }, [sessionId, isSyncing, refreshPendingStatus]);

  // Inicializar listeners de red
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshPendingStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync, refreshPendingStatus]);

  // Guardar catálogo de items en Dexie para consulta offline instantánea
  const cacheCatalogLocally = useCallback(async (items: LocalItem[]) => {
    if (!offlineDb || !items || items.length === 0) return;
    try {
      await offlineDb.items.bulkPut(items);
    } catch (e) {
      console.warn('Error al guardar items en Dexie:', e);
    }
  }, []);

  // Guardar conteo en Dexie (para cuando está offline o como respaldo local)
  const saveOfflineCount = useCallback(
    async (count: Omit<LocalCount, 'id' | 'synced'>) => {
      if (!offlineDb) return;
      await offlineDb.pendingCounts.add({
        ...count,
        synced: false,
      });
      await refreshPendingStatus();
    },
    [refreshPendingStatus]
  );

  // Guardar novedad en Dexie
  const saveOfflineNovelty = useCallback(
    async (novelty: Omit<LocalNovelty, 'id' | 'synced'>) => {
      if (!offlineDb) return;
      await offlineDb.pendingNovelties.add({
        ...novelty,
        synced: false,
      });
      await refreshPendingStatus();
    },
    [refreshPendingStatus]
  );

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncResult,
    triggerSync,
    cacheCatalogLocally,
    saveOfflineCount,
    saveOfflineNovelty,
    refreshPendingStatus,
  };
}
