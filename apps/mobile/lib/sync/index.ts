/**
 * Medication sync manager — offline-first encrypted sync to the server.
 *
 * Flow:
 * 1. Mobile writes happen to local SQLite and enqueue a SyncQueueItem.
 * 2. `processSyncQueue()` reads pending items, encrypts each payload with the
 *    device key, then sends them to the server API.
 * 3. On success the queue item is deleted (markSynced). On transient failure
 *    the retry counter is incremented (up to MAX_RETRIES = 5, then 'failed').
 * 4. Conflict resolution: last-write-wins using the updatedAt timestamp.
 *    The server always keeps the item with the newest timestamp.
 *
 * The server stores only the encrypted blob — it cannot read medication data.
 *
 * Auto-sync:
 * - `startSync()` installs a polling interval (every SYNC_INTERVAL_MS).
 * - Call `stopSync()` to clean up (e.g. on logout).
 *
 * React hook:
 * - `useSyncStatus()` returns 'synced' | 'pending' | 'syncing' | 'offline'
 *   and re-renders when status changes.
 */

import { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import { apiClient, ApiError } from '../api/client';
import { getPendingSync, markSynced, incrementAttempt } from '../db/sync-queue';
import { getOrCreateEncryptionKey, encryptPayload, checksumPayload } from './crypto';
import type { SyncOperation } from '@safedose/shared-types';

// ─── Constants ────────────────────────────────────────────────────────────────

const SYNC_INTERVAL_MS = 30_000; // 30 seconds

// ─── Internal state ───────────────────────────────────────────────────────────

type SyncStatus = 'synced' | 'pending' | 'syncing' | 'offline';

let _status: SyncStatus = 'synced';
let _statusListeners: Array<(s: SyncStatus) => void> = [];
let _intervalHandle: ReturnType<typeof setInterval> | null = null;

function setStatus(next: SyncStatus): void {
  if (_status === next) return;
  _status = next;
  _statusListeners.forEach((cb) => cb(next));
}

// ─── API response shapes ─────────────────────────────────────────────────────

interface UpsertResponse {
  success: boolean;
  id: string;
  localId: string;
  updatedAt: string;
}

// ─── Core sync logic ─────────────────────────────────────────────────────────

/**
 * Check network connectivity by probing the API health endpoint.
 * Returns true if the server is reachable. Falls back to attempting sync
 * if the probe itself throws a network error (treats throw as offline).
 */
async function isOnline(): Promise<boolean> {
  const apiBase =
    (Constants.expoConfig?.extra?.['apiUrl'] as string | undefined) ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${apiBase}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Map a SyncOperation to an HTTP method for the medications API.
 */
function operationToMethod(operation: SyncOperation): string {
  if (operation === 'create' || operation === 'update') return 'POST';
  return 'DELETE';
}

/**
 * Process all pending items in the sync queue.
 * Encrypts each payload, sends it to the server, and marks it synced on success.
 * Does nothing if the device is offline.
 */
export async function processSyncQueue(): Promise<void> {
  const online = await isOnline();
  if (!online) {
    setStatus('offline');
    return;
  }

  const pending = await getPendingSync();

  if (pending.length === 0) {
    setStatus('synced');
    return;
  }

  setStatus('syncing');

  let key: CryptoKey;
  try {
    key = await getOrCreateEncryptionKey();
  } catch (err) {
    console.error('[sync] Failed to get encryption key:', err);
    setStatus('pending');
    return;
  }

  for (const item of pending) {
    try {
      // Parse the raw payload (stored as JSON string in SQLite)
      let rawData: unknown;
      try {
        rawData = JSON.parse(item.payload);
      } catch {
        rawData = item.payload;
      }

      // Encrypt the payload before sending to server
      const encryptedPayload = await encryptPayload(rawData, key);
      const checksum = await checksumPayload(encryptedPayload);

      if (item.operation === 'delete') {
        // For deletes we need the server ID. We store it as localId in the queue
        // (it's the SQLite-generated UUID). The server endpoint is DELETE /medications/:id
        // but since the server uses its own UUID, we use the upsert POST with a
        // delete-flagged payload. In practice, the server cleans up via the
        // standard DELETE endpoint — we use localId as the server's localId key.
        await apiClient<{ success: boolean }>(`/medications/${encodeURIComponent(item.localId)}`, {
          method: 'DELETE',
        });
      } else {
        // CREATE and UPDATE both upsert on (userId, localId)
        await apiClient<UpsertResponse>('/medications', {
          method: operationToMethod(item.operation),
          body: {
            localId: item.localId,
            encryptedPayload,
            checksum,
          },
        });
      }

      await markSynced(item.id);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError
          ? `${err.statusCode}: ${err.message}`
          : err instanceof Error
            ? err.message
            : 'Unknown error';

      console.error(`[sync] Failed to sync item ${item.id} (${item.operation}):`, errorMessage);
      await incrementAttempt(item.id, errorMessage);
    }
  }

  // Check if anything is still pending after this pass
  const remaining = await getPendingSync();
  setStatus(remaining.length === 0 ? 'synced' : 'pending');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the sync polling loop. Safe to call multiple times — only one interval
 * runs at a time. Triggers an immediate sync pass on start.
 */
export function startSync(): void {
  if (_intervalHandle !== null) return;

  // Immediate first pass
  void processSyncQueue();

  _intervalHandle = setInterval(() => {
    void processSyncQueue();
  }, SYNC_INTERVAL_MS);
}

/**
 * Stop the sync polling loop. Call on logout or app background.
 */
export function stopSync(): void {
  if (_intervalHandle !== null) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
  setStatus('synced');
}

/**
 * Trigger an immediate sync pass. Returns a promise that resolves when the
 * pass completes. Useful after a write operation.
 */
export async function syncNow(): Promise<void> {
  return processSyncQueue();
}

// ─── React hook ───────────────────────────────────────────────────────────────

/**
 * Hook that returns the current sync status and re-renders on changes.
 *
 * Usage:
 *   const status = useSyncStatus();
 *   // 'synced' | 'pending' | 'syncing' | 'offline'
 */
export function useSyncStatus(): SyncStatus {
  const [status, setLocalStatus] = useState<SyncStatus>(_status);

  useEffect(() => {
    // Subscribe to status changes
    const listener = (next: SyncStatus): void => {
      setLocalStatus(next);
    };

    _statusListeners.push(listener);

    // Sync current state in case it changed before mount
    setLocalStatus(_status);

    return () => {
      _statusListeners = _statusListeners.filter((l) => l !== listener);
    };
  }, []);

  return status;
}
