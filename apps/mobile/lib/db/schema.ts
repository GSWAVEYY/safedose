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
  {
    version: 4,
    description: 'Add doctors and appointments tables; expand sync_queue entity_type constraint',
    up: async (db) => {
      // ---- doctors ----
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS doctors (
          id          TEXT    PRIMARY KEY NOT NULL,
          user_id     TEXT    NOT NULL,
          name        TEXT    NOT NULL,
          specialty   TEXT,
          phone       TEXT,
          address     TEXT,
          npi_number  TEXT,
          notes       TEXT,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL,
          deleted_at  INTEGER
        );
      `);
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors (user_id);'
      );

      // ---- appointments ----
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS appointments (
          id                    TEXT    PRIMARY KEY NOT NULL,
          user_id               TEXT    NOT NULL,
          doctor_id             TEXT    REFERENCES doctors(id),
          title                 TEXT    NOT NULL,
          scheduled_at          INTEGER NOT NULL,
          duration_minutes      INTEGER NOT NULL DEFAULT 30,
          location              TEXT,
          notes                 TEXT,
          pre_visit_checklist   TEXT    NOT NULL DEFAULT '[]',
          post_visit_notes      TEXT,
          status                TEXT    NOT NULL DEFAULT 'scheduled'
                                        CHECK(status IN ('scheduled','completed','cancelled')),
          created_at            INTEGER NOT NULL,
          updated_at            INTEGER NOT NULL,
          deleted_at            INTEGER
        );
      `);
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments (user_id);'
      );
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments (scheduled_at);'
      );

      // ---- expand sync_queue entity_type CHECK constraint ----
      // SQLite cannot ALTER a CHECK constraint, so we use rename-create-copy-drop.
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_queue_new (
          id            TEXT    PRIMARY KEY NOT NULL,
          local_id      TEXT    NOT NULL,
          entity_type   TEXT    NOT NULL CHECK(entity_type IN ('medication','schedule','dose_log','symptom','doctor','appointment')),
          operation     TEXT    NOT NULL CHECK(operation IN ('create','update','delete')),
          payload       TEXT    NOT NULL,
          checksum      TEXT    NOT NULL DEFAULT '',
          status        TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','syncing','synced','conflict','failed')),
          retry_count   INTEGER NOT NULL DEFAULT 0,
          created_at    INTEGER NOT NULL,
          updated_at    INTEGER NOT NULL,
          synced_at     INTEGER,
          conflict_data TEXT,
          last_error    TEXT
        );
      `);
      await db.execAsync(`
        INSERT INTO sync_queue_new
          SELECT * FROM sync_queue;
      `);
      await db.execAsync('DROP TABLE sync_queue;');
      await db.execAsync('ALTER TABLE sync_queue_new RENAME TO sync_queue;');
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_sync_queue_status      ON sync_queue (status);'
      );
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_sync_queue_entity_type ON sync_queue (entity_type);'
      );
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_sync_queue_local_id    ON sync_queue (local_id);'
      );
    },
  },
  {
    version: 5,
    description: 'medications — add refill_date, days_supply, pill_count columns for refill tracking',
    up: async (db) => {
      // SQLite ALTER TABLE supports ADD COLUMN only — one column at a time.
      // All three columns are nullable so adding them to existing rows is safe.
      //   refill_date — Unix ms timestamp of when the current supply runs out
      //   days_supply — how many days the current fill covers
      //   pill_count  — remaining unit count (REAL to support half-pills etc.)
      await db.execAsync(
        `ALTER TABLE medications ADD COLUMN refill_date INTEGER;`
      );
      await db.execAsync(
        `ALTER TABLE medications ADD COLUMN days_supply INTEGER;`
      );
      await db.execAsync(
        `ALTER TABLE medications ADD COLUMN pill_count REAL;`
      );
      // Index on refill_date enables the "needs refill within N days" query
      // to avoid a full-table scan.
      await db.execAsync(
        `CREATE INDEX IF NOT EXISTS idx_medications_refill_date ON medications (refill_date);`
      );
    },
  },
  {
    version: 6,
    description: 'Add wellness_checkins table for caregiver burnout prevention (PHQ-2 + wellness signals)',
    up: async (db) => {
      // wellness_checkins stores periodic caregiver self-assessments.
      // PHQ-2 is a validated 2-question depression screener (scores 0-3 each, total 0-6).
      // Score >= 3 warrants referral to full PHQ-9 screening.
      // Score >= 5 triggers crisis resource display.
      //
      // IMPORTANT: Mental health data is intentionally excluded from the sync
      // queue — it stays on device only and is never sent to the server.
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS wellness_checkins (
          id                    TEXT    PRIMARY KEY NOT NULL,
          user_id               TEXT    NOT NULL,
          phq2_q1               INTEGER NOT NULL CHECK(phq2_q1 BETWEEN 0 AND 3),
          phq2_q2               INTEGER NOT NULL CHECK(phq2_q2 BETWEEN 0 AND 3),
          phq2_score            INTEGER NOT NULL CHECK(phq2_score BETWEEN 0 AND 6),
          sleep_quality         INTEGER CHECK(sleep_quality BETWEEN 1 AND 5),
          stress_level          INTEGER CHECK(stress_level BETWEEN 1 AND 5),
          had_respite_this_week INTEGER NOT NULL DEFAULT 0,
          notes                 TEXT,
          checked_in_at         INTEGER NOT NULL,
          created_at            INTEGER NOT NULL
        );
      `);
      await db.execAsync(
        `CREATE INDEX IF NOT EXISTS idx_wellness_user ON wellness_checkins (user_id);`
      );
      await db.execAsync(
        `CREATE INDEX IF NOT EXISTS idx_wellness_date ON wellness_checkins (checked_in_at);`
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

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[DB] Running migration v${migration.version}: ${migration.description}`);
    }

    await db.withExclusiveTransactionAsync(async (txn) => {
      await migration.up(txn as unknown as SQLiteDatabase);
      await txn.runAsync(
        'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)',
        [migration.version, Date.now()]
      );
    });

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[DB] Migration v${migration.version} complete`);
    }
  }
}

export const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
