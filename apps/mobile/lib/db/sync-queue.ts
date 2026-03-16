/**
 * Sync queue repository.
 *
 * The sync queue stores every local mutation so the app can replay them
 * against the server when connectivity is restored. It is the backbone
 * of offline-first operation.
 *
 * NOTE: `addToSyncQueue` accepts either a live SQLiteDatabase or a
 * transaction object (both expose the same runAsync interface).
 * Repositories that need to enqueue inside a transaction pass their
 * `txn` argument here — this keeps the write and the queue entry atomic.
 */

import type { SyncOperation, SyncEntityType, SyncQueueItem, SyncStatus } from '@safedose/shared-types';

import { getDatabase } from './index';
import { generateId, now } from './utils';

// ---------------------------------------------------------------------------
// Minimal interface that both SQLiteDatabase and the transaction object satisfy
// ---------------------------------------------------------------------------

interface Queryable {
  runAsync(sql: string, params: (string | number | null)[]): Promise<{ changes?: number }>;
}

// ---------------------------------------------------------------------------
// Internal row type
// ---------------------------------------------------------------------------

interface SyncQueueRow {
  id: string;
  local_id: string;
  entity_type: string;
  operation: string;
  payload: string;
  checksum: string;
  status: string;
  retry_count: number;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
  conflict_data: string | null;
  last_error: string | null;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function rowToSyncQueueItem(row: SyncQueueRow): SyncQueueItem {
  return {
    id: row.id,
    localId: row.local_id,
    entityType: row.entity_type as SyncEntityType,
    operation: row.operation as SyncOperation,
    payload: row.payload,
    checksum: row.checksum,
    status: row.status as SyncStatus,
    retryCount: row.retry_count,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    syncedAt: row.synced_at !== null ? new Date(row.synced_at).toISOString() : undefined,
    conflictData: row.conflict_data ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AddToSyncQueueInput {
  localId: string;
  entityType: SyncEntityType;
  operation: SyncOperation;
  payload: string; // JSON string
}

/**
 * Add a mutation to the sync queue.
 *
 * Accepts a Queryable so callers can pass a transaction object and keep
 * the data write + queue insert atomic.
 */
export async function addToSyncQueue(
  queryable: Queryable,
  data: AddToSyncQueueInput
): Promise<void> {
  const id = generateId();
  const ts = now();

  await queryable.runAsync(
    `INSERT INTO sync_queue (
      id, local_id, entity_type, operation, payload,
      checksum, status, retry_count,
      created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,0,?,?)`,
    [
      id,
      data.localId,
      data.entityType,
      data.operation,
      data.payload,
      '',       // checksum — populated during encrypted sync in Sprint 2
      'pending',
      ts,
      ts,
    ]
  );
}

/**
 * Return all pending sync items ordered by creation time (oldest first).
 * Excludes items that have permanently failed (status = 'failed').
 */
export async function getPendingSync(): Promise<SyncQueueItem[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<SyncQueueRow>(
      `SELECT * FROM sync_queue
       WHERE status IN ('pending', 'conflict')
       ORDER BY created_at ASC`
    );
    return rows.map(rowToSyncQueueItem);
  } catch (error) {
    console.error('[sync-queue] getPendingSync failed:', error);
    throw error;
  }
}

/**
 * Mark a sync item as successfully synced and remove it from the queue.
 * We hard-delete rather than updating status to keep the queue lean.
 */
export async function markSynced(id: string): Promise<void> {
  const db = getDatabase();
  try {
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  } catch (error) {
    console.error('[sync-queue] markSynced failed:', error);
    throw error;
  }
}

/**
 * Increment the retry counter and record the failure reason.
 * If retry_count reaches the threshold the status is set to 'failed'.
 */
export async function incrementAttempt(id: string, error: string): Promise<void> {
  const db = getDatabase();
  const ts = now();
  const MAX_RETRIES = 5;

  try {
    await db.runAsync(
      `UPDATE sync_queue SET
         retry_count = retry_count + 1,
         last_error  = ?,
         updated_at  = ?,
         status = CASE WHEN retry_count + 1 >= ? THEN 'failed' ELSE 'pending' END
       WHERE id = ?`,
      [error, ts, MAX_RETRIES, id]
    );
  } catch (err) {
    console.error('[sync-queue] incrementAttempt failed:', err);
    throw err;
  }
}

/**
 * Return all sync items for a given entity, regardless of status.
 * Useful for checking if a local entity has pending changes before displaying it.
 */
export async function getSyncItemsForEntity(
  entityType: SyncEntityType,
  localId: string
): Promise<SyncQueueItem[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<SyncQueueRow>(
      `SELECT * FROM sync_queue
       WHERE entity_type = ? AND local_id = ?
       ORDER BY created_at ASC`,
      [entityType, localId]
    );
    return rows.map(rowToSyncQueueItem);
  } catch (error) {
    console.error('[sync-queue] getSyncItemsForEntity failed:', error);
    throw error;
  }
}

/**
 * Resolve a conflict by replacing the local payload with server data
 * and resetting status to 'pending' for re-sync.
 */
export async function resolveConflict(
  id: string,
  resolvedPayload: string
): Promise<void> {
  const db = getDatabase();
  const ts = now();
  try {
    await db.runAsync(
      `UPDATE sync_queue SET
         payload        = ?,
         status         = 'pending',
         conflict_data  = NULL,
         retry_count    = 0,
         updated_at     = ?
       WHERE id = ?`,
      [resolvedPayload, ts, id]
    );
  } catch (error) {
    console.error('[sync-queue] resolveConflict failed:', error);
    throw error;
  }
}
