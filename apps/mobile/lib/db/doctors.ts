/**
 * Doctor repository — CRUD operations for the doctors table.
 *
 * All writes enqueue a sync item so the server stays eventually consistent.
 * Reads never touch the sync queue.
 *
 * Row shape: snake_case columns → camelCase Doctor objects.
 */

import { getDatabase } from './index';

// Types defined locally — not yet in shared-types
export interface Doctor {
  id: string;
  userId: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  address: string | null;
  npiNumber: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}
export type DoctorCreate = Omit<Doctor, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export type DoctorUpdate = Partial<DoctorCreate>;
import { addToSyncQueue } from './sync-queue';
import { generateId, now } from './utils';
import { getOrCreateEncryptionKey, encryptPayload } from '../sync/crypto';

// ---------------------------------------------------------------------------
// Internal row type matching the SQLite column names
// ---------------------------------------------------------------------------

interface DoctorRow {
  id: string;
  user_id: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  address: string | null;
  npi_number: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

// ---------------------------------------------------------------------------
// Row → domain model mapping
// ---------------------------------------------------------------------------

function rowToDoctor(row: DoctorRow): Doctor {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    specialty: row.specialty ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
    npiNumber: row.npi_number ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Return all non-deleted doctors for a user, sorted by name.
 */
export async function getAllDoctors(userId: string): Promise<Doctor[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<DoctorRow>(
      `SELECT * FROM doctors
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY name ASC`,
      [userId]
    );
    return rows.map(rowToDoctor);
  } catch (error) {
    console.error('[doctors] getAllDoctors failed:', error);
    throw error;
  }
}

/**
 * Return a single doctor by ID (null if not found or soft-deleted).
 */
export async function getDoctorById(id: string, userId: string): Promise<Doctor | null> {
  const db = getDatabase();
  try {
    const row = await db.getFirstAsync<DoctorRow>(
      'SELECT * FROM doctors WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [id, userId]
    );
    return row ? rowToDoctor(row) : null;
  } catch (error) {
    console.error('[doctors] getDoctorById failed:', error);
    throw error;
  }
}

/**
 * Create a new doctor and enqueue it for server sync.
 */
export async function createDoctor(userId: string, data: DoctorCreate): Promise<Doctor> {
  const db = getDatabase();
  const id = generateId();
  const ts = now();

  const doctor: Doctor = {
    id,
    userId,
    name: data.name,
    specialty: data.specialty,
    phone: data.phone,
    address: data.address,
    npiNumber: data.npiNumber,
    notes: data.notes,
    createdAt: ts,
    updatedAt: ts,
  };

  const encKey = await getOrCreateEncryptionKey();
  const encryptedSyncPayload = await encryptPayload(doctor, encKey);

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO doctors (
          id, user_id, name, specialty, phone, address, npi_number, notes,
          created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          userId,
          doctor.name,
          doctor.specialty ?? null,
          doctor.phone ?? null,
          doctor.address ?? null,
          doctor.npiNumber ?? null,
          doctor.notes ?? null,
          ts,
          ts,
        ]
      );

      await addToSyncQueue(txn, {
        localId: id,
        entityType: 'doctor',
        operation: 'create',
        payload: encryptedSyncPayload,
      });
    });

    return doctor;
  } catch (error) {
    console.error('[doctors] createDoctor failed:', error);
    throw error;
  }
}

/**
 * Update an existing doctor by ID.
 */
export async function updateDoctor(
  id: string,
  userId: string,
  updates: Partial<DoctorUpdate>
): Promise<Doctor | null> {
  const db = getDatabase();
  const ts = now();

  const existing = await getDoctorById(id, userId);
  if (existing === null) {
    return null;
  }

  const merged: Doctor = {
    ...existing,
    ...updates,
    id,
    userId,
    updatedAt: ts,
  };

  const encKey = await getOrCreateEncryptionKey();
  const encryptedSyncPayload = await encryptPayload(merged, encKey);

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `UPDATE doctors SET
          name        = ?,
          specialty   = ?,
          phone       = ?,
          address     = ?,
          npi_number  = ?,
          notes       = ?,
          updated_at  = ?
        WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [
          merged.name,
          merged.specialty ?? null,
          merged.phone ?? null,
          merged.address ?? null,
          merged.npiNumber ?? null,
          merged.notes ?? null,
          ts,
          id,
          userId,
        ]
      );

      await addToSyncQueue(txn, {
        localId: id,
        entityType: 'doctor',
        operation: 'update',
        payload: encryptedSyncPayload,
      });
    });

    return merged;
  } catch (error) {
    console.error('[doctors] updateDoctor failed:', error);
    throw error;
  }
}

/**
 * Soft-delete a doctor. Sets deleted_at rather than removing the row,
 * so the sync layer can propagate the deletion to the server.
 */
export async function deleteDoctor(id: string, userId: string): Promise<boolean> {
  const db = getDatabase();
  const ts = now();

  const existing = await getDoctorById(id, userId);
  if (existing === null) {
    return false;
  }

  const encKey = await getOrCreateEncryptionKey();
  const encryptedSyncPayload = await encryptPayload({ id }, encKey);

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `UPDATE doctors SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [ts, ts, id, userId]
      );

      await addToSyncQueue(txn, {
        localId: id,
        entityType: 'doctor',
        operation: 'delete',
        payload: encryptedSyncPayload,
      });
    });

    return true;
  } catch (error) {
    console.error('[doctors] deleteDoctor failed:', error);
    throw error;
  }
}
