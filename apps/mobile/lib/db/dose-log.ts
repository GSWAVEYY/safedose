/**
 * Dose log repository — record and query dose events.
 *
 * DoseLog rows are append-only. We never update or delete them —
 * they form an audit trail. Soft-delete is not required because
 * dose logs are keyed by the patient, not the medication alone.
 */

import type { DoseLog, DoseEventType } from '@safedose/shared-types';

import { getDatabase } from './index';
import { addToSyncQueue } from './sync-queue';
import { generateId, now } from './utils';

// ---------------------------------------------------------------------------
// Internal row type
// ---------------------------------------------------------------------------

interface DoseLogRow {
  id: string;
  patient_id: string;
  medication_id: string;
  medication_name: string;
  event_type: string;
  scheduled_at: number;
  confirmed_at: number | null;
  confirmed_by: string | null;
  notes: string | null;
  created_at: number;
  synced_at: number | null;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function rowToDoseLog(row: DoseLogRow): DoseLog {
  return {
    id: row.id,
    patientId: row.patient_id,
    medicationId: row.medication_id,
    medicationName: row.medication_name,
    eventType: row.event_type as DoseEventType,
    scheduledAt: new Date(row.scheduled_at).toISOString(),
    confirmedAt: row.confirmed_at !== null
      ? new Date(row.confirmed_at).toISOString()
      : undefined,
    confirmedBy: row.confirmed_by ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LogDoseInput {
  patientId: string;
  medicationId: string;
  medicationName: string;
  eventType: DoseEventType;
  scheduledAt: string; // ISO 8601
  confirmedAt?: string; // ISO 8601
  confirmedBy?: string;
  notes?: string;
}

/**
 * Record a dose event (taken, missed, skipped, etc.) and enqueue for sync.
 */
export async function logDose(data: LogDoseInput): Promise<DoseLog> {
  const db = getDatabase();
  const id = generateId();
  const ts = now();

  const entry: DoseLog = {
    id,
    patientId: data.patientId,
    medicationId: data.medicationId,
    medicationName: data.medicationName,
    eventType: data.eventType,
    scheduledAt: data.scheduledAt,
    confirmedAt: data.confirmedAt,
    confirmedBy: data.confirmedBy,
    notes: data.notes,
    createdAt: new Date(ts).toISOString(),
  };

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO dose_log (
          id, patient_id, medication_id, medication_name,
          event_type, scheduled_at, confirmed_at, confirmed_by,
          notes, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          data.patientId,
          data.medicationId,
          data.medicationName,
          data.eventType,
          new Date(data.scheduledAt).getTime(),
          data.confirmedAt ? new Date(data.confirmedAt).getTime() : null,
          data.confirmedBy ?? null,
          data.notes ?? null,
          ts,
        ]
      );

      await addToSyncQueue(txn, {
        localId: id,
        entityType: 'dose_log',
        operation: 'create',
        payload: JSON.stringify(entry),
      });
    });

    return entry;
  } catch (error) {
    console.error('[dose-log] logDose failed:', error);
    throw error;
  }
}

/**
 * Return dose history for a medication over the last N days.
 * Results are ordered newest first.
 */
export async function getDoseHistory(
  medicationId: string,
  days: number
): Promise<DoseLog[]> {
  const db = getDatabase();
  const since = now() - days * 24 * 60 * 60 * 1000;

  try {
    const rows = await db.getAllAsync<DoseLogRow>(
      `SELECT * FROM dose_log
       WHERE medication_id = ? AND scheduled_at >= ?
       ORDER BY scheduled_at DESC`,
      [medicationId, since]
    );
    return rows.map(rowToDoseLog);
  } catch (error) {
    console.error('[dose-log] getDoseHistory failed:', error);
    throw error;
  }
}

/**
 * Return all dose events for today (midnight to now).
 */
export async function getTodaysDoseLog(patientId: string): Promise<DoseLog[]> {
  const db = getDatabase();

  const midnightToday = new Date();
  midnightToday.setHours(0, 0, 0, 0);
  const midnightTs = midnightToday.getTime();

  try {
    const rows = await db.getAllAsync<DoseLogRow>(
      `SELECT * FROM dose_log
       WHERE patient_id = ? AND scheduled_at >= ?
       ORDER BY scheduled_at ASC`,
      [patientId, midnightTs]
    );
    return rows.map(rowToDoseLog);
  } catch (error) {
    console.error('[dose-log] getTodaysDoseLog failed:', error);
    throw error;
  }
}

/**
 * Calculate the adherence rate (percentage of scheduled doses actually taken)
 * for a medication over the last N days.
 *
 * Returns a value between 0 and 1, or null if no scheduled doses exist.
 */
export async function getAdherenceRate(
  medicationId: string,
  days: number
): Promise<number | null> {
  const db = getDatabase();
  const since = now() - days * 24 * 60 * 60 * 1000;

  try {
    const row = await db.getFirstAsync<{ total: number; taken: number }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN event_type IN ('taken', 'caregiver_confirmed') THEN 1 ELSE 0 END) AS taken
       FROM dose_log
       WHERE medication_id = ? AND scheduled_at >= ?`,
      [medicationId, since]
    );

    if (row === null || row.total === 0) {
      return null;
    }

    return row.taken / row.total;
  } catch (error) {
    console.error('[dose-log] getAdherenceRate failed:', error);
    throw error;
  }
}

/**
 * Return all missed doses across all medications for a patient since the given timestamp.
 */
export async function getMissedDoses(
  patientId: string,
  since: number
): Promise<DoseLog[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<DoseLogRow>(
      `SELECT * FROM dose_log
       WHERE patient_id = ? AND event_type = 'missed' AND scheduled_at >= ?
       ORDER BY scheduled_at DESC`,
      [patientId, since]
    );
    return rows.map(rowToDoseLog);
  } catch (error) {
    console.error('[dose-log] getMissedDoses failed:', error);
    throw error;
  }
}
