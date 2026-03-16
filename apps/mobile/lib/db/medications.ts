/**
 * Medication repository — CRUD operations for the medications table.
 *
 * All writes enqueue a sync item so the server stays eventually consistent.
 * Reads never touch the sync queue.
 *
 * Row shape: snake_case columns → camelCase Medication objects.
 */

import type { Medication, MedicationCreate, MedicationUpdate } from '@safedose/shared-types';

import { getDatabase } from './index';
import { addToSyncQueue } from './sync-queue';
import { generateId, now } from './utils';
import { getOrCreateEncryptionKey, encryptPayload } from '../sync/crypto';

// ---------------------------------------------------------------------------
// Internal row type matching the SQLite column names
// ---------------------------------------------------------------------------

interface MedicationRow {
  id: string;
  user_id: string;
  name: string;
  generic_name: string | null;
  rxcui: string | null;
  dosage_amount: number;
  dosage_unit: string;
  route: string;
  instructions: string | null;
  prescriber: string | null;
  pharmacy: string | null;
  refills_remaining: number | null;
  expires_at: number | null;
  started_at: number | null;
  ended_at: number | null;
  is_active: number;
  image_uri: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
  deleted_at: number | null;
}

// ---------------------------------------------------------------------------
// Row → domain model mapping
// ---------------------------------------------------------------------------

function rowToMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    genericName: row.generic_name ?? undefined,
    rxcui: row.rxcui ?? undefined,
    dosageAmount: row.dosage_amount,
    dosageUnit: row.dosage_unit as Medication['dosageUnit'],
    route: row.route as Medication['route'],
    instructions: row.instructions ?? undefined,
    prescriber: row.prescriber ?? undefined,
    pharmacy: row.pharmacy ?? undefined,
    refillsRemaining: row.refills_remaining ?? undefined,
    expiresAt: row.expires_at !== null ? new Date(row.expires_at).toISOString() : undefined,
    startedAt: row.started_at !== null ? new Date(row.started_at).toISOString() : undefined,
    endedAt: row.ended_at !== null ? new Date(row.ended_at).toISOString() : undefined,
    isActive: row.is_active === 1,
    imageUri: row.image_uri ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Return all non-deleted medications for a user, sorted by name.
 */
export async function getAllMedications(userId: string): Promise<Medication[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<MedicationRow>(
      `SELECT * FROM medications
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY name ASC`,
      [userId]
    );
    return rows.map(rowToMedication);
  } catch (error) {
    console.error('[medications] getAllMedications failed:', error);
    throw error;
  }
}

/**
 * Return a single medication by ID (null if not found or soft-deleted).
 */
export async function getMedicationById(
  id: string,
  userId: string
): Promise<Medication | null> {
  const db = getDatabase();
  try {
    const row = await db.getFirstAsync<MedicationRow>(
      'SELECT * FROM medications WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [id, userId]
    );
    return row ? rowToMedication(row) : null;
  } catch (error) {
    console.error('[medications] getMedicationById failed:', error);
    throw error;
  }
}

/**
 * Create a new medication and enqueue it for server sync.
 */
export async function createMedication(
  userId: string,
  data: MedicationCreate
): Promise<Medication> {
  const db = getDatabase();
  const id = generateId();
  const ts = now();

  const medication: Medication = {
    id,
    userId,
    name: data.name,
    genericName: data.genericName,
    rxcui: data.rxcui,
    dosageAmount: data.dosageAmount,
    dosageUnit: data.dosageUnit,
    route: data.route,
    instructions: data.instructions,
    prescriber: data.prescriber,
    pharmacy: data.pharmacy,
    refillsRemaining: data.refillsRemaining,
    expiresAt: data.expiresAt,
    startedAt: data.startedAt,
    endedAt: data.endedAt,
    isActive: data.isActive ?? true,
    imageUri: data.imageUri,
    createdAt: new Date(ts).toISOString(),
    updatedAt: new Date(ts).toISOString(),
  };

  // Encrypt the payload before writing to the local sync queue.
  // The sync queue stores ciphertext — plaintext medication data never
  // persists to SQLite. The same encrypted blob is forwarded to the server
  // unchanged (server stores only ciphertext in medication_sync.encrypted_payload).
  const encKey = await getOrCreateEncryptionKey();
  const encryptedSyncPayload = await encryptPayload(medication, encKey);

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO medications (
          id, user_id, name, generic_name, rxcui,
          dosage_amount, dosage_unit, route,
          instructions, prescriber, pharmacy, refills_remaining,
          expires_at, started_at, ended_at,
          is_active, image_uri,
          created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          userId,
          medication.name,
          medication.genericName ?? null,
          medication.rxcui ?? null,
          medication.dosageAmount,
          medication.dosageUnit,
          medication.route,
          medication.instructions ?? null,
          medication.prescriber ?? null,
          medication.pharmacy ?? null,
          medication.refillsRemaining ?? null,
          medication.expiresAt ? new Date(medication.expiresAt).getTime() : null,
          medication.startedAt ? new Date(medication.startedAt).getTime() : null,
          medication.endedAt ? new Date(medication.endedAt).getTime() : null,
          medication.isActive ? 1 : 0,
          medication.imageUri ?? null,
          ts,
          ts,
        ]
      );

      await addToSyncQueue(txn, {
        localId: id,
        entityType: 'medication',
        operation: 'create',
        payload: encryptedSyncPayload,
      });
    });

    return medication;
  } catch (error) {
    console.error('[medications] createMedication failed:', error);
    throw error;
  }
}

/**
 * Update an existing medication by ID.
 * Only the fields present in `updates` are changed.
 */
export async function updateMedication(
  id: string,
  userId: string,
  updates: Partial<MedicationUpdate>
): Promise<Medication | null> {
  const db = getDatabase();
  const ts = now();

  const existing = await getMedicationById(id, userId);
  if (existing === null) {
    return null;
  }

  const merged: Medication = {
    ...existing,
    ...updates,
    id,
    userId,
    updatedAt: new Date(ts).toISOString(),
  };

  const encKey = await getOrCreateEncryptionKey();
  const encryptedSyncPayload = await encryptPayload(merged, encKey);

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `UPDATE medications SET
          name              = ?,
          generic_name      = ?,
          rxcui             = ?,
          dosage_amount     = ?,
          dosage_unit       = ?,
          route             = ?,
          instructions      = ?,
          prescriber        = ?,
          pharmacy          = ?,
          refills_remaining = ?,
          expires_at        = ?,
          started_at        = ?,
          ended_at          = ?,
          is_active         = ?,
          image_uri         = ?,
          updated_at        = ?
        WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [
          merged.name,
          merged.genericName ?? null,
          merged.rxcui ?? null,
          merged.dosageAmount,
          merged.dosageUnit,
          merged.route,
          merged.instructions ?? null,
          merged.prescriber ?? null,
          merged.pharmacy ?? null,
          merged.refillsRemaining ?? null,
          merged.expiresAt ? new Date(merged.expiresAt).getTime() : null,
          merged.startedAt ? new Date(merged.startedAt).getTime() : null,
          merged.endedAt ? new Date(merged.endedAt).getTime() : null,
          merged.isActive ? 1 : 0,
          merged.imageUri ?? null,
          ts,
          id,
          userId,
        ]
      );

      await addToSyncQueue(txn, {
        localId: id,
        entityType: 'medication',
        operation: 'update',
        payload: encryptedSyncPayload,
      });
    });

    return merged;
  } catch (error) {
    console.error('[medications] updateMedication failed:', error);
    throw error;
  }
}

/**
 * Soft-delete a medication. Sets deleted_at rather than removing the row,
 * so the sync layer can propagate the deletion to the server.
 */
export async function deleteMedication(id: string, userId: string): Promise<boolean> {
  const db = getDatabase();
  const ts = now();

  const existing = await getMedicationById(id, userId);
  if (existing === null) {
    return false;
  }

  const encKey = await getOrCreateEncryptionKey();
  const encryptedSyncPayload = await encryptPayload({ id }, encKey);

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `UPDATE medications SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [ts, ts, id, userId]
      );

      await addToSyncQueue(txn, {
        localId: id,
        entityType: 'medication',
        operation: 'delete',
        payload: encryptedSyncPayload,
      });
    });

    return true;
  } catch (error) {
    console.error('[medications] deleteMedication failed:', error);
    throw error;
  }
}

/**
 * Full-text search across medication name and generic name.
 */
export async function searchMedications(
  userId: string,
  query: string
): Promise<Medication[]> {
  const db = getDatabase();
  const pattern = `%${query}%`;
  try {
    const rows = await db.getAllAsync<MedicationRow>(
      `SELECT * FROM medications
       WHERE user_id = ? AND deleted_at IS NULL
         AND (name LIKE ? OR generic_name LIKE ?)
       ORDER BY name ASC`,
      [userId, pattern, pattern]
    );
    return rows.map(rowToMedication);
  } catch (error) {
    console.error('[medications] searchMedications failed:', error);
    throw error;
  }
}

/**
 * Return medications filtered by status.
 *   active        — isActive = true, no endedAt
 *   paused        — isActive = false, no endedAt
 *   discontinued  — endedAt is set
 */
export async function getMedicationsByStatus(
  userId: string,
  status: 'active' | 'paused' | 'discontinued'
): Promise<Medication[]> {
  const db = getDatabase();
  try {
    let sql: string;
    let params: (string | number)[];

    if (status === 'active') {
      sql = `SELECT * FROM medications
             WHERE user_id = ? AND deleted_at IS NULL AND is_active = 1 AND ended_at IS NULL
             ORDER BY name ASC`;
      params = [userId];
    } else if (status === 'paused') {
      sql = `SELECT * FROM medications
             WHERE user_id = ? AND deleted_at IS NULL AND is_active = 0 AND ended_at IS NULL
             ORDER BY name ASC`;
      params = [userId];
    } else {
      sql = `SELECT * FROM medications
             WHERE user_id = ? AND deleted_at IS NULL AND ended_at IS NOT NULL
             ORDER BY name ASC`;
      params = [userId];
    }

    const rows = await db.getAllAsync<MedicationRow>(sql, params);
    return rows.map(rowToMedication);
  } catch (error) {
    console.error('[medications] getMedicationsByStatus failed:', error);
    throw error;
  }
}
