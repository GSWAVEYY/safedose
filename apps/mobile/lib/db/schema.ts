/**
 * SafeDose — SQLite schema definitions and migrations.
 *
 * All tables are created here. The schema_version table tracks applied
 * migrations so we can evolve the schema safely on existing devices.
 *
 * Timestamp convention: all *_at columns store Unix milliseconds (Date.now()).
 * JSON columns: stored as TEXT, serialised with JSON.stringify / parsed with JSON.parse.
 * Booleans: stored as INTEGER (0 = false, 1 = true) — SQLite has no BOOLEAN type.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

// ---------------------------------------------------------------------------
// DDL statements
// ---------------------------------------------------------------------------

const CREATE_SCHEMA_VERSION = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version   INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );
`;

const CREATE_MEDICATIONS = `
  CREATE TABLE IF NOT EXISTS medications (
    id             TEXT    PRIMARY KEY NOT NULL,
    user_id        TEXT    NOT NULL,
    name           TEXT    NOT NULL,
    generic_name   TEXT,
    rxcui          TEXT,
    dosage_amount  REAL    NOT NULL,
    dosage_unit    TEXT    NOT NULL,
    route          TEXT    NOT NULL,
    instructions   TEXT,
    prescriber     TEXT,
    pharmacy       TEXT,
    refills_remaining INTEGER,
    expires_at     INTEGER,
    started_at     INTEGER,
    ended_at       INTEGER,
    is_active      INTEGER NOT NULL DEFAULT 1,
    image_uri      TEXT,
    notes          TEXT,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    synced_at      INTEGER,
    deleted_at     INTEGER
  );
`;

const CREATE_MEDICATIONS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_medications_user_id    ON medications (user_id);
  CREATE INDEX IF NOT EXISTS idx_medications_is_active  ON medications (is_active);
  CREATE INDEX IF NOT EXISTS idx_medications_name       ON medications (name);
`;

const CREATE_SCHEDULES = `
  CREATE TABLE IF NOT EXISTS schedules (
    id               TEXT    PRIMARY KEY NOT NULL,
    medication_id    TEXT    NOT NULL REFERENCES medications(id),
    user_id          TEXT    NOT NULL,
    times            TEXT    NOT NULL,  -- JSON array of HH:mm strings
    frequency_value  INTEGER NOT NULL,
    frequency_unit   TEXT    NOT NULL,
    start_date       TEXT    NOT NULL,  -- ISO 8601 date string YYYY-MM-DD
    end_date         TEXT,              -- ISO 8601 date string, NULL = indefinite
    with_food        INTEGER NOT NULL DEFAULT 0,
    notes            TEXT,
    is_active        INTEGER NOT NULL DEFAULT 1,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL
  );
`;

const CREATE_SCHEDULES_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_schedules_medication_id ON schedules (medication_id);
  CREATE INDEX IF NOT EXISTS idx_schedules_is_active     ON schedules (is_active);
`;

const CREATE_DOSE_LOG = `
  CREATE TABLE IF NOT EXISTS dose_log (
    id               TEXT    PRIMARY KEY NOT NULL,
    patient_id       TEXT    NOT NULL,
    medication_id    TEXT    NOT NULL REFERENCES medications(id),
    medication_name  TEXT    NOT NULL,
    event_type       TEXT    NOT NULL CHECK(event_type IN ('scheduled','taken','missed','skipped','late','caregiver_confirmed')),
    scheduled_at     INTEGER NOT NULL,
    confirmed_at     INTEGER,
    confirmed_by     TEXT,
    notes            TEXT,
    created_at       INTEGER NOT NULL,
    synced_at        INTEGER
  );
`;

const CREATE_DOSE_LOG_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_dose_log_medication_id  ON dose_log (medication_id);
  CREATE INDEX IF NOT EXISTS idx_dose_log_patient_id     ON dose_log (patient_id);
  CREATE INDEX IF NOT EXISTS idx_dose_log_scheduled_at   ON dose_log (scheduled_at);
  CREATE INDEX IF NOT EXISTS idx_dose_log_event_type     ON dose_log (event_type);
`;

const CREATE_EMERGENCY_CARD = `
  CREATE TABLE IF NOT EXISTS emergency_card (
    id                       TEXT    PRIMARY KEY NOT NULL,
    user_id                  TEXT    NOT NULL UNIQUE,
    qr_token                 TEXT    NOT NULL,
    display_name             TEXT    NOT NULL,
    date_of_birth            TEXT,
    blood_type               TEXT,
    allergies                TEXT    NOT NULL DEFAULT '[]',  -- JSON array of strings
    medications              TEXT    NOT NULL DEFAULT '[]',  -- JSON array of medication IDs
    emergency_contacts       TEXT    NOT NULL DEFAULT '[]',  -- JSON array of EmergencyContact objects
    primary_physician_name   TEXT,
    primary_physician_phone  TEXT,
    medical_conditions       TEXT    NOT NULL DEFAULT '[]',  -- JSON array of strings
    notes                    TEXT,
    updated_at               INTEGER NOT NULL
  );
`;

const CREATE_SYMPTOMS = `
  CREATE TABLE IF NOT EXISTS symptoms (
    id            TEXT    PRIMARY KEY NOT NULL,
    user_id       TEXT    NOT NULL,
    symptoms      TEXT    NOT NULL DEFAULT '[]',
    severity      INTEGER NOT NULL CHECK(severity BETWEEN 1 AND 10),
    reported_at   INTEGER NOT NULL,
    notes         TEXT,
    created_at    INTEGER NOT NULL,
    deleted_at    INTEGER,
    synced_at     INTEGER
  );
`;

const CREATE_SYMPTOMS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_symptoms_user_id    ON symptoms (user_id);
  CREATE INDEX IF NOT EXISTS idx_symptoms_reported_at ON symptoms (reported_at);
`;

const CREATE_SYNC_QUEUE = `
  CREATE TABLE IF NOT EXISTS sync_queue (
    id            TEXT    PRIMARY KEY NOT NULL,
    local_id      TEXT    NOT NULL,
    entity_type   TEXT    NOT NULL CHECK(entity_type IN ('medication','schedule','dose_log','symptom')),
    operation     TEXT    NOT NULL CHECK(operation IN ('create','update','delete')),
    payload       TEXT    NOT NULL, -- JSON string, encrypted at rest in future
    checksum      TEXT    NOT NULL DEFAULT '',
    status        TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','syncing','synced','conflict','failed')),
    retry_count   INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    synced_at     INTEGER,
    conflict_data TEXT,
    last_error    TEXT
  );
`;

const CREATE_SYNC_QUEUE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_sync_queue_status      ON sync_queue (status);
  CREATE INDEX IF NOT EXISTS idx_sync_queue_entity_type ON sync_queue (entity_type);
  CREATE INDEX IF NOT EXISTS idx_sync_queue_local_id    ON sync_queue (local_id);
`;

// ---------------------------------------------------------------------------
// Migration registry
// Each entry runs exactly once, identified by its version number.
// Always append — never reorder or delete.
// ---------------------------------------------------------------------------

type Migration = {
  version: number;
  description: string;
  up: (db: SQLiteDatabase) => Promise<void>;
};

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema — medications, schedules, dose_log, emergency_card, symptoms, sync_queue',
    up: async (db) => {
      await db.execAsync(CREATE_MEDICATIONS);
      await db.execAsync(CREATE_MEDICATIONS_INDEXES);
      await db.execAsync(CREATE_SCHEDULES);
      await db.execAsync(CREATE_SCHEDULES_INDEXES);
      await db.execAsync(CREATE_DOSE_LOG);
      await db.execAsync(CREATE_DOSE_LOG_INDEXES);
      await db.execAsync(CREATE_EMERGENCY_CARD);
      await db.execAsync(CREATE_SYMPTOMS);
      await db.execAsync(CREATE_SYMPTOMS_INDEXES);
      await db.execAsync(CREATE_SYNC_QUEUE);
      await db.execAsync(CREATE_SYNC_QUEUE_INDEXES);
    },
  },
  {
    version: 2,
    description: 'emergency_card — add emergency_contacts (JSON), primary_physician split, medical_conditions',
    up: async (db) => {
      // SQLite ALTER TABLE only supports ADD COLUMN — one at a time.
      await db.execAsync(
        `ALTER TABLE emergency_card ADD COLUMN emergency_contacts TEXT NOT NULL DEFAULT '[]';`
      );
      await db.execAsync(
        `ALTER TABLE emergency_card ADD COLUMN primary_physician_name TEXT;`
      );
      await db.execAsync(
        `ALTER TABLE emergency_card ADD COLUMN primary_physician_phone TEXT;`
      );
      await db.execAsync(
        `ALTER TABLE emergency_card ADD COLUMN medical_conditions TEXT NOT NULL DEFAULT '[]';`
      );
      // No legacy single-contact data to migrate; v1 schema never contained
      // emergency_contact_name, emergency_contact_phone, or primary_physician columns.
      // These UPDATE statements were removed after Shield audit identified them as
      // referencing non-existent columns, which caused a crash loop.
    },
  },
  {
    version: 3,
    description: 'symptoms — replace description+severity(1-5) with symptoms JSON array + severity(1-10), add created_at/deleted_at',
    up: async (db) => {
      // SQLite does not support DROP COLUMN on tables with CHECK constraints,
      // so we use the recommended rename-create-copy-drop pattern.
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS symptoms_new (
          id            TEXT    PRIMARY KEY NOT NULL,
          user_id       TEXT    NOT NULL,
          symptoms      TEXT    NOT NULL DEFAULT '[]',
          severity      INTEGER NOT NULL CHECK(severity BETWEEN 1 AND 10),
          reported_at   INTEGER NOT NULL,
          notes         TEXT,
          created_at    INTEGER NOT NULL,
          deleted_at    INTEGER,
          synced_at     INTEGER
        );
      `);
      // Migrate existing rows: wrap old description string in a JSON array,
      // map severity 1-5 → 1-10 by doubling (clamped to 10).
      await db.execAsync(`
        INSERT INTO symptoms_new
          (id, user_id, symptoms, severity, reported_at, notes, created_at, synced_at)
        SELECT
          id,
          user_id,
          json_array(description),
          MIN(severity * 2, 10),
          reported_at,
          notes,
          reported_at,
          synced_at
        FROM symptoms;
      `);
      await db.execAsync('DROP TABLE symptoms;');
      await db.execAsync('ALTER TABLE symptoms_new RENAME TO symptoms;');
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_symptoms_user_id    ON symptoms (user_id);'
      );
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_symptoms_reported_at ON symptoms (reported_at);'
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all pending migrations against the provided database.
 * Safe to call on every app start — already-applied migrations are skipped.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Bootstrap the version table before anything else.
  await db.execAsync(CREATE_SCHEMA_VERSION);

  const applied = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version ASC'
  );
  const appliedVersions = new Set(applied.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    console.log(`[DB] Running migration v${migration.version}: ${migration.description}`);

    await db.withExclusiveTransactionAsync(async (txn) => {
      await migration.up(txn as unknown as SQLiteDatabase);
      await txn.runAsync(
        'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)',
        [migration.version, Date.now()]
      );
    });

    console.log(`[DB] Migration v${migration.version} complete`);
  }
}

export const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
