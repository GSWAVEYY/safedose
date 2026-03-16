/**
 * Emergency card repository — CRUD for the emergency_card table.
 *
 * The emergency card is a single row per user (UNIQUE constraint on user_id).
 * All data stays local — this table is intentionally excluded from the sync queue
 * because first-responder access works via QR token, not a server call.
 *
 * Timestamp convention: Unix milliseconds (Date.now()).
 * JSON columns: allergies, medications — stored as JSON text arrays.
 */

import { getDatabase } from './index';
import { generateId, now } from './utils';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BloodType =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-'
  | 'unknown';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export interface EmergencyCard {
  id: string;
  userId: string;
  qrToken: string;
  displayName: string;
  dateOfBirth: string | null;
  bloodType: BloodType | null;
  /** List of allergy strings */
  allergies: string[];
  /** IDs of active medications (resolved via medications store at render time) */
  medicationIds: string[];
  emergencyContacts: EmergencyContact[];
  primaryPhysicianName: string | null;
  primaryPhysicianPhone: string | null;
  medicalConditions: string[];
  notes: string | null;
  updatedAt: number;
}

export interface EmergencyCardUpdate {
  displayName?: string;
  dateOfBirth?: string | null;
  bloodType?: BloodType | null;
  allergies?: string[];
  medicationIds?: string[];
  emergencyContacts?: EmergencyContact[];
  primaryPhysicianName?: string | null;
  primaryPhysicianPhone?: string | null;
  medicalConditions?: string[];
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Internal row type — SQLite column names
// ---------------------------------------------------------------------------

interface EmergencyCardRow {
  id: string;
  user_id: string;
  qr_token: string;
  display_name: string;
  date_of_birth: string | null;
  blood_type: string | null;
  allergies: string;
  medications: string;
  emergency_contacts: string | null;
  primary_physician_name: string | null;
  primary_physician_phone: string | null;
  medical_conditions: string | null;
  notes: string | null;
  updated_at: number;
}

// ---------------------------------------------------------------------------
// Row ↔ domain object helpers
// ---------------------------------------------------------------------------

function rowToCard(row: EmergencyCardRow): EmergencyCard {
  return {
    id: row.id,
    userId: row.user_id,
    qrToken: row.qr_token,
    displayName: row.display_name,
    dateOfBirth: row.date_of_birth,
    bloodType: (row.blood_type as BloodType) ?? null,
    allergies: JSON.parse(row.allergies) as string[],
    medicationIds: JSON.parse(row.medications) as string[],
    emergencyContacts: row.emergency_contacts
      ? (JSON.parse(row.emergency_contacts) as EmergencyContact[])
      : [],
    primaryPhysicianName: row.primary_physician_name,
    primaryPhysicianPhone: row.primary_physician_phone,
    medicalConditions: row.medical_conditions
      ? (JSON.parse(row.medical_conditions) as string[])
      : [],
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the emergency card for a user, or null if not yet created.
 */
export async function getEmergencyCard(userId: string): Promise<EmergencyCard | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<EmergencyCardRow>(
    `SELECT id, user_id, qr_token, display_name, date_of_birth, blood_type,
            allergies, medications, emergency_contacts, primary_physician_name,
            primary_physician_phone, medical_conditions, notes, updated_at
     FROM emergency_card
     WHERE user_id = ?`,
    [userId]
  );
  return row ? rowToCard(row) : null;
}

/**
 * Upsert the emergency card for a user.
 * Creates a new card with a random QR token on first call; updates existing on subsequent calls.
 */
export async function upsertEmergencyCard(
  userId: string,
  data: EmergencyCardUpdate
): Promise<EmergencyCard> {
  const db = getDatabase();
  const existing = await getEmergencyCard(userId);

  if (existing) {
    // Update existing card — only overwrite fields that are provided.
    const updated: EmergencyCard = {
      ...existing,
      ...data,
      updatedAt: now(),
    };

    await db.runAsync(
      `UPDATE emergency_card
       SET display_name           = ?,
           date_of_birth          = ?,
           blood_type             = ?,
           allergies              = ?,
           medications            = ?,
           emergency_contacts     = ?,
           primary_physician_name = ?,
           primary_physician_phone= ?,
           medical_conditions     = ?,
           notes                  = ?,
           updated_at             = ?
       WHERE user_id = ?`,
      [
        updated.displayName,
        updated.dateOfBirth ?? null,
        updated.bloodType ?? null,
        JSON.stringify(updated.allergies),
        JSON.stringify(updated.medicationIds),
        JSON.stringify(updated.emergencyContacts),
        updated.primaryPhysicianName ?? null,
        updated.primaryPhysicianPhone ?? null,
        JSON.stringify(updated.medicalConditions),
        updated.notes ?? null,
        updated.updatedAt,
        userId,
      ]
    );

    return updated;
  }

  // Create fresh card with a generated QR token.
  const card: EmergencyCard = {
    id: generateId(),
    userId,
    qrToken: generateId(), // Sprint 2: replace with server-issued signed token
    displayName: data.displayName ?? '',
    dateOfBirth: data.dateOfBirth ?? null,
    bloodType: data.bloodType ?? null,
    allergies: data.allergies ?? [],
    medicationIds: data.medicationIds ?? [],
    emergencyContacts: data.emergencyContacts ?? [],
    primaryPhysicianName: data.primaryPhysicianName ?? null,
    primaryPhysicianPhone: data.primaryPhysicianPhone ?? null,
    medicalConditions: data.medicalConditions ?? [],
    notes: data.notes ?? null,
    updatedAt: now(),
  };

  await db.runAsync(
    `INSERT INTO emergency_card
       (id, user_id, qr_token, display_name, date_of_birth, blood_type,
        allergies, medications, emergency_contacts, primary_physician_name,
        primary_physician_phone, medical_conditions, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      card.id,
      card.userId,
      card.qrToken,
      card.displayName,
      card.dateOfBirth ?? null,
      card.bloodType ?? null,
      JSON.stringify(card.allergies),
      JSON.stringify(card.medicationIds),
      JSON.stringify(card.emergencyContacts),
      card.primaryPhysicianName ?? null,
      card.primaryPhysicianPhone ?? null,
      JSON.stringify(card.medicalConditions),
      card.notes ?? null,
      card.updatedAt,
    ]
  );

  return card;
}
