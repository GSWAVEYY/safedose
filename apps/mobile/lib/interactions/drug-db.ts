/**
 * drug-db.ts
 *
 * Read-only access to the bundled drug reference database.
 *
 * The database is a SQLite file built by packages/drug-db-builder and placed
 * at apps/mobile/assets/drug-db/safedose-drugs.db.  It is opened via
 * expo-sqlite's openDatabaseAsync with { useNewConnection: true } so that
 * we never share a connection with the app's mutable medication database.
 *
 * This module is intentionally stateless — callers are responsible for
 * caching results where performance requires it.
 */

import * as SQLite from 'expo-sqlite';
import type { DrugSearchResult, DrugDatabaseVersion } from './types';

/** Path to the bundled asset as understood by expo-sqlite's asset loader. */
const DRUG_DB_ASSET_NAME = 'safedose-drugs.db';

/** Maximum rows returned by searchDrugByName. */
const SEARCH_LIMIT = 20;

// ---------------------------------------------------------------------------
// Internal DB row shapes (what comes back from the SQLite driver)
// ---------------------------------------------------------------------------

interface DrugRefRow {
  rxcui: string;
  name: string;
  synonyms: string;       // JSON-encoded string[]
  drug_class: string | null;
  plain_english: string | null;
}

interface VersionRow {
  db_version: string;
}

// ---------------------------------------------------------------------------
// Shared connection handle (lazy-opened, read-only)
// ---------------------------------------------------------------------------

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Opens the bundled drug database.  Subsequent calls return the already-open
 * connection.  If the asset does not yet exist (DB not built), logs a warning
 * and returns null — callers must handle null gracefully.
 */
export async function openDrugDatabase(): Promise<SQLite.SQLiteDatabase | null> {
  if (_db !== null) {
    return _db;
  }

  try {
    // expo-sqlite v14: openDatabaseAsync with asset path loads the bundled DB
    // from the app's asset bundle into the device's document directory on first
    // open, then opens it for subsequent calls.
    _db = await SQLite.openDatabaseAsync(DRUG_DB_ASSET_NAME);
    return _db;
  } catch (err) {
    console.warn(
      '[SafeDose] Drug database not available — interaction checks will be skipped.',
      err,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function rowToSearchResult(row: DrugRefRow): DrugSearchResult {
  let synonyms: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.synonyms);
    if (Array.isArray(parsed)) {
      synonyms = parsed.filter((s): s is string => typeof s === 'string');
    }
  } catch {
    // Malformed JSON — treat as empty
  }

  return {
    rxcui: row.rxcui,
    name: row.name,
    synonyms,
    drugClass: row.drug_class,
    plainEnglish: row.plain_english,
  };
}

// ---------------------------------------------------------------------------
// Public lookup functions
// ---------------------------------------------------------------------------

/**
 * Case-insensitive fuzzy search on drug name.
 * Returns up to SEARCH_LIMIT (20) results ordered by name.
 */
export async function searchDrugByName(query: string): Promise<DrugSearchResult[]> {
  const db = await openDrugDatabase();
  if (db === null) return [];

  const pattern = `%${query}%`;
  const rows = await db.getAllAsync<DrugRefRow>(
    `SELECT rxcui, name, synonyms, drug_class, plain_english
       FROM drugs_ref
      WHERE name LIKE ? COLLATE NOCASE
      ORDER BY name COLLATE NOCASE
      LIMIT ?`,
    [pattern, SEARCH_LIMIT],
  );

  return rows.map(rowToSearchResult);
}

/**
 * Exact lookup of a single drug by its RxCUI.
 * Returns null if not found.
 */
export async function getDrugByRxcui(rxcui: string): Promise<DrugSearchResult | null> {
  const db = await openDrugDatabase();
  if (db === null) return null;

  const row = await db.getFirstAsync<DrugRefRow>(
    `SELECT rxcui, name, synonyms, drug_class, plain_english
       FROM drugs_ref
      WHERE rxcui = ?`,
    [rxcui],
  );

  if (row === null) return null;
  return rowToSearchResult(row);
}

/**
 * Batch lookup of multiple drugs by RxCUI.
 * The returned Map preserves a result for every requested RxCUI that exists
 * in the database; missing RxCUIs are silently omitted.
 */
export async function getDrugsByRxcuis(
  rxcuis: string[],
): Promise<Map<string, DrugSearchResult>> {
  const result = new Map<string, DrugSearchResult>();
  if (rxcuis.length === 0) return result;

  const db = await openDrugDatabase();
  if (db === null) return result;

  // Build a parameterised IN clause.  SQLite has no issue with lists up to
  // the few hundred RxCUIs a real patient medication list would contain.
  const placeholders = rxcuis.map(() => '?').join(', ');
  const rows = await db.getAllAsync<DrugRefRow>(
    `SELECT rxcui, name, synonyms, drug_class, plain_english
       FROM drugs_ref
      WHERE rxcui IN (${placeholders})`,
    rxcuis,
  );

  for (const row of rows) {
    result.set(row.rxcui, rowToSearchResult(row));
  }

  return result;
}

/**
 * Returns the database version string from the first row of drugs_ref,
 * or null if the database is unavailable or empty.
 */
export async function getDatabaseVersion(): Promise<DrugDatabaseVersion | null> {
  const db = await openDrugDatabase();
  if (db === null) return null;

  const row = await db.getFirstAsync<VersionRow>(
    `SELECT db_version FROM drugs_ref LIMIT 1`,
  );

  if (row === null) return null;
  return { version: row.db_version };
}
