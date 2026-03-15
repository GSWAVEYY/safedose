// Offline sync queue types

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncEntityType = 'medication' | 'schedule' | 'dose_log' | 'symptom';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';

export interface SyncQueueItem {
  id: string;
  localId: string; // device-generated ID before server sync
  entityType: SyncEntityType;
  operation: SyncOperation;
  payload: string; // JSON string — encrypted at rest on device
  checksum: string; // SHA-256 of payload for integrity check
  status: SyncStatus;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  conflictData?: string; // JSON string of server version on conflict
}

export interface SyncBatchRequest {
  items: Array<{
    localId: string;
    entityType: SyncEntityType;
    operation: SyncOperation;
    encryptedPayload: string;
    checksum: string;
  }>;
}

export interface SyncBatchResponse {
  synced: Array<{ localId: string; serverId: string }>;
  conflicts: Array<{ localId: string; serverData: string }>;
  failed: Array<{ localId: string; reason: string }>;
}
