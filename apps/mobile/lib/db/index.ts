/**
 * SafeDose — SQLite database client.
 *
 * Exposes a singleton database instance initialised once at app start.
 * Call `initDatabase()` from your root layout before rendering any screen
 * that reads or writes data.
 *
 * Usage:
 *   const db = getDatabase();     // throws if initDatabase() not yet called
 *   await initDatabase();         // idempotent — safe to call multiple times
 */

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './schema';

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

const DB_NAME = 'safedose.db';

let _db: SQLiteDatabase | null = null;

/**
 * Initialise the SQLite database and run any pending migrations.
 * Idempotent — subsequent calls return the already-open instance.
 */
export async function initDatabase(): Promise<SQLiteDatabase> {
  if (_db !== null) {
    return _db;
  }

  const db = await openDatabaseAsync(DB_NAME);

  // Enable WAL mode for better concurrent read performance.
  await db.execAsync('PRAGMA journal_mode = WAL;');

  // Enforce foreign-key constraints — SQLite disables them by default.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await runMigrations(db);

  _db = db;
  console.log('[DB] Initialised:', DB_NAME);

  return db;
}

/**
 * Return the initialised database instance.
 * Throws if `initDatabase()` has not been called yet.
 */
export function getDatabase(): SQLiteDatabase {
  if (_db === null) {
    throw new Error(
      '[DB] Database not initialised. Call initDatabase() at app startup before accessing the database.'
    );
  }
  return _db;
}

/**
 * Close the database — for testing and cleanup only.
 * Normal app code should never call this.
 */
export async function closeDatabase(): Promise<void> {
  if (_db !== null) {
    await _db.closeAsync();
    _db = null;
  }
}

export type { SQLiteDatabase };
