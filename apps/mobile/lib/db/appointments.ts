/**
 * Appointment repository — CRUD operations for the appointments table.
 *
 * All writes enqueue a sync item so the server stays eventually consistent.
 * Reads never touch the sync queue.
 *
 * Row shape: snake_case columns → camelCase Appointment objects.
 * getAppointmentById performs a LEFT JOIN against doctors to include doctorName.
 */

import { getDatabase } from './index';

// Types defined locally — not yet in shared-types
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';
export interface Appointment {
  id: string;
  userId: string;
  doctorId: string | null;
  doctorName?: string;
  title: string;
  scheduledAt: number;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
  preVisitChecklist: string[];
  postVisitNotes: string | null;
  status: AppointmentStatus;
  createdAt: number;
  updatedAt: number;
}
export type AppointmentCreate = Omit<Appointment, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'doctorName'>;
export type AppointmentUpdate = Partial<AppointmentCreate>;
import { addToSyncQueue } from './sync-queue';
import { generateId, now } from './utils';
import { getOrCreateEncryptionKey, encryptPayload } from '../sync/crypto';

// ---------------------------------------------------------------------------
// Internal row type matching the SQLite column names
// ---------------------------------------------------------------------------

interface AppointmentRow {
  id: string;
  user_id: string;
  doctor_id: string | null;
  doctor_name: string | null; // joined from doctors table
  title: string;
  scheduled_at: number;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  pre_visit_checklist: string; // JSON text
  post_visit_notes: string | null;
  status: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

// ---------------------------------------------------------------------------
// Row → domain model mapping
// ---------------------------------------------------------------------------

function rowToAppointment(row: AppointmentRow): Appointment {
  let preVisitChecklist: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.pre_visit_checklist);
    if (Array.isArray(parsed)) {
      preVisitChecklist = parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    // Malformed JSON — default to empty list.
  }

  return {
    id: row.id,
    userId: row.user_id,
    doctorId: row.doctor_id ?? null,
    doctorName: row.doctor_name ?? undefined,
    title: row.title,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    location: row.location ?? null,
    notes: row.notes ?? null,
    preVisitChecklist,
    postVisitNotes: row.post_visit_notes ?? null,
    status: row.status as AppointmentStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Base SELECT with doctor name join
// ---------------------------------------------------------------------------

const SELECT_WITH_DOCTOR = `
  SELECT
    a.*,
    d.name AS doctor_name
  FROM appointments a
  LEFT JOIN doctors d ON d.id = a.doctor_id AND d.deleted_at IS NULL
`;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Return upcoming (scheduled) appointments for a user, sorted by date ascending.
 * Includes appointments scheduled from now onwards, plus any 'scheduled' status
 * appointments that may be in the past (edge case: overdue appointments).
 */
export async function getUpcomingAppointments(userId: string): Promise<Appointment[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<AppointmentRow>(
      `${SELECT_WITH_DOCTOR}
       WHERE a.user_id = ? AND a.deleted_at IS NULL AND a.status = 'scheduled'
       ORDER BY a.scheduled_at ASC`,
      [userId]
    );
    return rows.map(rowToAppointment);
  } catch (error) {
    console.error('[appointments] getUpcomingAppointments failed:', error);
    throw error;
  }
}

/**
 * Return past (completed or cancelled) appointments, most recent first.
 */
export async function getPastAppointments(
  userId: string,
  limit: number = 50
): Promise<Appointment[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<AppointmentRow>(
      `${SELECT_WITH_DOCTOR}
       WHERE a.user_id = ? AND a.deleted_at IS NULL AND a.status IN ('completed','cancelled')
       ORDER BY a.scheduled_at DESC
       LIMIT ?`,
      [userId, limit]
    );
    return rows.map(rowToAppointment);
  } catch (error) {
    console.error('[appointments] getPastAppointments failed:', error);
    throw error;
  }
}

/**
 * Return a single appointment by ID with doctor info (null if not found or deleted).
 */
export async function getAppointmentById(
  id: string,
  userId: string
): Promise<Appointment | null> {
  const db = getDatabase();
  try {
    const row = await db.getFirstAsync<AppointmentRow>(
      `${SELECT_WITH_DOCTOR}
       WHERE a.id = ? AND a.user_id = ? AND a.deleted_at IS NULL`,
      [id, userId]
    );
    return row ? rowToAppointment(row) : null;
  } catch (error) {
    console.error('[appointments] getAppointmentById failed:', error);
    throw error;
  }
}

/**
 * Create a new appointment and enqueue it for server sync.
 */
export async function createAppointment(
  userId: string,
  data: AppointmentCreate
): Promise<Appointment> {
  const db = getDatabase();
  const id = generateId();
  const ts = now();

  const appointment: Appointment = {
    id,
    userId,
    doctorId: data.doctorId,
    title: data.title,
    scheduledAt: data.scheduledAt,
    durationMinutes: data.durationMinutes ?? 30,
    location: data.location,
    notes: data.notes,
    preVisitChecklist: data.preVisitChecklist ?? [],
    postVisitNotes: data.postVisitNotes ?? null,
    status: 'scheduled',
    createdAt: ts,
    updatedAt: ts,
  };

  const encKey = await getOrCreateEncryptionKey();
  const encryptedSyncPayload = await encryptPayload(appointment, encKey);

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO appointments (
          id, user_id, doctor_id, title, scheduled_at,
          duration_minutes, location, notes, pre_visit_checklist,
          post_visit_notes, status, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          userId,
          appointment.doctorId ?? null,
          appointment.title,
          new Date(appointment.scheduledAt).getTime(),
          appointment.durationMinutes,
          appointment.location ?? null,
          appointment.notes ?? null,
          JSON.stringify(appointment.preVisitChecklist),
          null,
          'scheduled',
          ts,
          ts,
        ]
      );

      await addToSyncQueue(txn, {
        localId: id,
        entityType: 'appointment',
        operation: 'create',
        payload: encryptedSyncPayload,
      });
    });

    return appointment;
  } catch (error) {
    console.error('[appointments] createAppointment failed:', error);
    throw error;
  }
}

/**
 * Update an existing appointment by ID.
 */
export async function updateAppointment(
  id: string,
  userId: string,
  updates: Partial<AppointmentUpdate>
): Promise<Appointment | null> {
  const db = getDatabase();
  const ts = now();

  const existing = await getAppointmentById(id, userId);
  if (existing === null) {
    return null;
  }

  const merged: Appointment = {
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
        `UPDATE appointments SET
          doctor_id           = ?,
          title               = ?,
          scheduled_at        = ?,
          duration_minutes    = ?,
          location            = ?,
          notes               = ?,
          pre_visit_checklist = ?,
          post_visit_notes    = ?,
          status              = ?,
          updated_at          = ?
        WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [
          merged.doctorId ?? null,
          merged.title,
          new Date(merged.scheduledAt).getTime(),
          merged.durationMinutes,
          merged.location ?? null,
          merged.notes ?? null,
          JSON.stringify(merged.preVisitChecklist),
          merged.postVisitNotes ?? null,
          merged.status,
          ts,
          id,
          userId,
        ]
      );

      await addToSyncQueue(txn, {
        localId: id,
        entityType: 'appointment',
        operation: 'update',
        payload: encryptedSyncPayload,
      });
    });

    return merged;
  } catch (error) {
    console.error('[appointments] updateAppointment failed:', error);
    throw error;
  }
}

/**
 * Cancel an appointment by setting status = 'cancelled'.
 */
export async function cancelAppointment(id: string, userId: string): Promise<Appointment | null> {
  return updateAppointment(id, userId, { status: 'cancelled' });
}

/**
 * Mark an appointment as completed, optionally recording post-visit notes.
 */
export async function completeAppointment(
  id: string,
  userId: string,
  postVisitNotes?: string
): Promise<Appointment | null> {
  return updateAppointment(id, userId, {
    status: 'completed',
    postVisitNotes,
  });
}
