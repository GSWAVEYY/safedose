/**
 * Schedule repository — CRUD for the schedules table plus today's dose list.
 */

import type { Schedule } from '@safedose/shared-types';

import { getDatabase } from './index';
import { generateId, now } from './utils';

// ---------------------------------------------------------------------------
// Internal row type
// ---------------------------------------------------------------------------

interface ScheduleRow {
  id: string;
  medication_id: string;
  user_id: string;
  times: string; // JSON array of HH:mm strings
  frequency_value: number;
  frequency_unit: string;
  start_date: string;
  end_date: string | null;
  with_food: number;
  notes: string | null;
  is_active: number;
  created_at: number;
  updated_at: number;
}

// Row for today's doses query (joins medication name)
interface TodayDoseRow extends ScheduleRow {
  medication_name: string;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function rowToSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    medicationId: row.medication_id,
    userId: row.user_id,
    times: JSON.parse(row.times) as string[],
    frequencyValue: row.frequency_value,
    frequencyUnit: row.frequency_unit as Schedule['frequencyUnit'],
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    withFood: row.with_food === 1,
    notes: row.notes ?? undefined,
    isActive: row.is_active === 1,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getSchedulesForMedication(
  medicationId: string
): Promise<Schedule[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<ScheduleRow>(
      'SELECT * FROM schedules WHERE medication_id = ? AND is_active = 1 ORDER BY start_date ASC',
      [medicationId]
    );
    return rows.map(rowToSchedule);
  } catch (error) {
    console.error('[schedules] getSchedulesForMedication failed:', error);
    throw error;
  }
}

export async function getScheduleById(id: string): Promise<Schedule | null> {
  const db = getDatabase();
  try {
    const row = await db.getFirstAsync<ScheduleRow>(
      'SELECT * FROM schedules WHERE id = ?',
      [id]
    );
    return row ? rowToSchedule(row) : null;
  } catch (error) {
    console.error('[schedules] getScheduleById failed:', error);
    throw error;
  }
}

export interface CreateScheduleInput {
  medicationId: string;
  userId: string;
  times: string[];
  frequencyValue: number;
  frequencyUnit: Schedule['frequencyUnit'];
  startDate: string;
  endDate?: string;
  withFood?: boolean;
  notes?: string;
}

export async function createSchedule(data: CreateScheduleInput): Promise<Schedule> {
  const db = getDatabase();
  const id = generateId();
  const ts = now();

  try {
    await db.runAsync(
      `INSERT INTO schedules (
        id, medication_id, user_id, times,
        frequency_value, frequency_unit,
        start_date, end_date, with_food, notes,
        is_active, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      [
        id,
        data.medicationId,
        data.userId,
        JSON.stringify(data.times),
        data.frequencyValue,
        data.frequencyUnit,
        data.startDate,
        data.endDate ?? null,
        data.withFood ? 1 : 0,
        data.notes ?? null,
        ts,
        ts,
      ]
    );

    const created = await getScheduleById(id);
    if (created === null) {
      throw new Error('[schedules] createSchedule: inserted row not found');
    }
    return created;
  } catch (error) {
    console.error('[schedules] createSchedule failed:', error);
    throw error;
  }
}

export type UpdateScheduleInput = Partial<Omit<CreateScheduleInput, 'medicationId' | 'userId'>>;

export async function updateSchedule(
  id: string,
  updates: UpdateScheduleInput
): Promise<Schedule | null> {
  const db = getDatabase();
  const ts = now();

  const existing = await getScheduleById(id);
  if (existing === null) {
    return null;
  }

  const merged = { ...existing, ...updates };

  try {
    await db.runAsync(
      `UPDATE schedules SET
        times           = ?,
        frequency_value = ?,
        frequency_unit  = ?,
        start_date      = ?,
        end_date        = ?,
        with_food       = ?,
        notes           = ?,
        updated_at      = ?
       WHERE id = ?`,
      [
        JSON.stringify(merged.times),
        merged.frequencyValue,
        merged.frequencyUnit,
        merged.startDate,
        merged.endDate ?? null,
        merged.withFood ? 1 : 0,
        merged.notes ?? null,
        ts,
        id,
      ]
    );

    return await getScheduleById(id);
  } catch (error) {
    console.error('[schedules] updateSchedule failed:', error);
    throw error;
  }
}

/**
 * Hard-delete a schedule (no sync needed — cascades from medication delete
 * or is explicitly removed by user action before sync is relevant).
 */
export async function deleteSchedule(id: string): Promise<boolean> {
  const db = getDatabase();
  try {
    const result = await db.runAsync('DELETE FROM schedules WHERE id = ?', [id]);
    return (result.changes ?? 0) > 0;
  } catch (error) {
    console.error('[schedules] deleteSchedule failed:', error);
    throw error;
  }
}

export interface TodayDose {
  schedule: Schedule;
  medicationName: string;
  times: string[];
}

/**
 * Return all active schedules whose date range covers today,
 * joined with the medication name for display purposes.
 *
 * Filtering by day-of-week or exact frequency is done in JS after
 * the query because SQLite has limited date arithmetic.
 */
export async function getTodaysDoses(userId: string): Promise<TodayDose[]> {
  const db = getDatabase();

  // Today's date as YYYY-MM-DD in local time.
  const todayStr = new Date().toISOString().slice(0, 10);

  try {
    const rows = await db.getAllAsync<TodayDoseRow>(
      `SELECT s.*, m.name AS medication_name
       FROM schedules s
       JOIN medications m ON m.id = s.medication_id
       WHERE s.user_id = ?
         AND s.is_active = 1
         AND m.deleted_at IS NULL
         AND m.is_active = 1
         AND s.start_date <= ?
         AND (s.end_date IS NULL OR s.end_date >= ?)
       ORDER BY s.start_date ASC`,
      [userId, todayStr, todayStr]
    );

    return rows.map((row) => ({
      schedule: rowToSchedule(row),
      medicationName: row.medication_name,
      times: JSON.parse(row.times) as string[],
    }));
  } catch (error) {
    console.error('[schedules] getTodaysDoses failed:', error);
    throw error;
  }
}
