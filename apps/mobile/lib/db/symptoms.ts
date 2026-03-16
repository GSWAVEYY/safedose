/**
 * Symptom repository — log and query user-reported symptom events.
 *
 * Symptoms are written with a soft-delete (deleted_at) so the sync layer
 * can propagate deletions to the server. All writes enqueue a sync item.
 *
 * Column contract:
 *   symptoms  TEXT  — JSON-serialised string[] of symptom tags
 *   severity  INTEGER 1-10
 *   reported_at / created_at — Unix milliseconds
 */

import type { Symptom, SymptomInput, SymptomFrequency } from '@safedose/shared-types';

import { getDatabase } from './index';
import { addToSyncQueue } from './sync-queue';
import { generateId, now } from './utils';

// ---------------------------------------------------------------------------
// Internal row type
// ---------------------------------------------------------------------------

interface SymptomRow {
  id: string;
  user_id: string;
  symptoms: string; // JSON-serialised string[]
  severity: number;
  reported_at: number;
  notes: string | null;
  created_at: number;
  deleted_at: number | null;
  synced_at: number | null;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function rowToSymptom(row: SymptomRow): Symptom {
  return {
    id: row.id,
    userId: row.user_id,
    symptoms: JSON.parse(row.symptoms) as string[],
    severity: row.severity,
    reportedAt: new Date(row.reported_at).toISOString(),
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    deletedAt: row.deleted_at !== null
      ? new Date(row.deleted_at).toISOString()
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert a new symptom record and enqueue it for server sync.
 * `reported_at` defaults to now so callers can pass a backdated timestamp
 * if needed in future (e.g. manual entry from yesterday).
 */
export async function logSymptom(
  userId: string,
  data: SymptomInput,
  reportedAt?: number
): Promise<Symptom> {
  const db = getDatabase();
  const id = generateId();
  const ts = now();
  const reportTs = reportedAt ?? ts;

  const entry: Symptom = {
    id,
    userId,
    symptoms: data.symptoms,
    severity: data.severity,
    reportedAt: new Date(reportTs).toISOString(),
    notes: data.notes,
    createdAt: new Date(ts).toISOString(),
  };

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO symptoms
           (id, user_id, symptoms, severity, reported_at, notes, created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [
          id,
          userId,
          JSON.stringify(data.symptoms),
          data.severity,
          reportTs,
          data.notes ?? null,
          ts,
        ]
      );

      await addToSyncQueue(txn, {
        localId: id,
        entityType: 'symptom',
        operation: 'create',
        payload: JSON.stringify(entry),
      });
    });

    return entry;
  } catch (error) {
    console.error('[symptoms] logSymptom failed:', error);
    throw error;
  }
}

/**
 * Return all non-deleted symptom logs for a user in the last N days,
 * ordered newest first.
 */
export async function getSymptomHistory(
  userId: string,
  days: number
): Promise<Symptom[]> {
  const db = getDatabase();
  const since = now() - days * 24 * 60 * 60 * 1000;

  try {
    const rows = await db.getAllAsync<SymptomRow>(
      `SELECT * FROM symptoms
       WHERE user_id = ? AND reported_at >= ? AND deleted_at IS NULL
       ORDER BY reported_at DESC`,
      [userId, since]
    );
    return rows.map(rowToSymptom);
  } catch (error) {
    console.error('[symptoms] getSymptomHistory failed:', error);
    throw error;
  }
}

/**
 * Return all non-deleted symptom logs for a user on a specific calendar date.
 * `date` must be an ISO 8601 date string (YYYY-MM-DD) in local time.
 */
export async function getSymptomsByDate(
  userId: string,
  date: string
): Promise<Symptom[]> {
  const db = getDatabase();

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  try {
    const rows = await db.getAllAsync<SymptomRow>(
      `SELECT * FROM symptoms
       WHERE user_id = ?
         AND reported_at >= ?
         AND reported_at <= ?
         AND deleted_at IS NULL
       ORDER BY reported_at ASC`,
      [userId, dayStart.getTime(), dayEnd.getTime()]
    );
    return rows.map(rowToSymptom);
  } catch (error) {
    console.error('[symptoms] getSymptomsByDate failed:', error);
    throw error;
  }
}

/**
 * Return a frequency map of symptom tags for a user over the last N days.
 * Each key is a tag string; the value is how many times it appeared.
 * Only non-deleted rows are counted.
 *
 * Example: { headache: 4, nausea: 2 }
 */
export async function getSymptomFrequency(
  userId: string,
  days: number
): Promise<SymptomFrequency> {
  const since = now() - days * 24 * 60 * 60 * 1000;
  const db = getDatabase();

  try {
    const rows = await db.getAllAsync<SymptomRow>(
      `SELECT symptoms FROM symptoms
       WHERE user_id = ? AND reported_at >= ? AND deleted_at IS NULL`,
      [userId, since]
    );

    const freq: SymptomFrequency = {};
    for (const row of rows) {
      const tags = JSON.parse(row.symptoms) as string[];
      for (const tag of tags) {
        freq[tag] = (freq[tag] ?? 0) + 1;
      }
    }
    return freq;
  } catch (error) {
    console.error('[symptoms] getSymptomFrequency failed:', error);
    throw error;
  }
}

/**
 * Soft-delete a symptom entry. Sets deleted_at so the sync layer can
 * propagate the deletion to the server.
 * Returns false if the entry was not found or already deleted.
 */
export async function deleteSymptom(id: string, userId: string): Promise<boolean> {
  const db = getDatabase();
  const ts = now();

  try {
    let affected = 0;

    await db.withExclusiveTransactionAsync(async (txn) => {
      const result = await txn.runAsync(
        `UPDATE symptoms SET deleted_at = ?
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [ts, id, userId]
      );
      affected = result.changes ?? 0;

      if (affected > 0) {
        await addToSyncQueue(txn, {
          localId: id,
          entityType: 'symptom',
          operation: 'delete',
          payload: JSON.stringify({ id }),
        });
      }
    });

    return affected > 0;
  } catch (error) {
    console.error('[symptoms] deleteSymptom failed:', error);
    throw error;
  }
}
