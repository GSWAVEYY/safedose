/**
 * build-db.ts
 *
 * Reads all fetched JSON from data/rxnorm/ and data/interactions/,
 * then writes a normalized SQLite database to output/safedose-drugs.db.
 *
 * This is the final build step — runs after fetch-rxnorm and fetch-interactions.
 *
 * Output schema:
 *   drugs_ref   — one row per drug (rxcui, name, synonyms, class, etc.)
 *   interactions — drug-drug interaction pairs
 *
 * Both tables have indexes for fast app-side lookup.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs, { type Database } from "sql.js";
import ora from "ora";
import { type RxNormDrugRecord } from "./fetch-rxnorm.js";
import { type InteractionBatch } from "./fetch-interactions.js";
import { formatBytes } from "./utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RXNORM_DIR = path.resolve(__dirname, "../data/rxnorm");
const INTERACTIONS_DIR = path.resolve(__dirname, "../data/interactions");
const OUTPUT_DIR = path.resolve(__dirname, "../output");
const DB_PATH = path.join(OUTPUT_DIR, "safedose-drugs.db");

/** Version string embedded into every row's db_version field. */
const DB_VERSION = new Date().toISOString().slice(0, 10); // e.g. "2026-03-15"

// ---------------------------------------------------------------------------
// Schema DDL
// ---------------------------------------------------------------------------

const DDL_DRUGS = `
CREATE TABLE IF NOT EXISTS drugs_ref (
  rxcui        TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  synonyms     TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  drug_class   TEXT,
  plain_english TEXT,                        -- pre-computed plain-language explanation (populated where available)
  common_sides TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings (reserved for future enrichment)
  db_version   TEXT NOT NULL
);
`;

const DDL_INTERACTIONS = `
CREATE TABLE IF NOT EXISTS interactions (
  rxcui_1     TEXT NOT NULL,
  rxcui_2     TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('contraindicated','major','moderate','minor','unknown')),
  description TEXT NOT NULL,
  mechanism   TEXT NOT NULL DEFAULT '',
  management  TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT 'RxNorm',
  db_version  TEXT NOT NULL,
  PRIMARY KEY (rxcui_1, rxcui_2)
);
`;

const DDL_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_drugs_name     ON drugs_ref (name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_int_rxcui1     ON interactions (rxcui_1);
CREATE INDEX IF NOT EXISTS idx_int_rxcui2     ON interactions (rxcui_2);
CREATE INDEX IF NOT EXISTS idx_int_severity   ON interactions (severity);
`;

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

function loadRxNormRecords(): RxNormDrugRecord[] {
  if (!fs.existsSync(RXNORM_DIR)) {
    console.warn(`[build] RxNorm data directory not found: ${RXNORM_DIR}`);
    return [];
  }

  const files = fs
    .readdirSync(RXNORM_DIR)
    .filter((f) => f.endsWith(".json"));

  const records: RxNormDrugRecord[] = [];

  for (const file of files) {
    const filePath = path.join(RXNORM_DIR, file);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const record = JSON.parse(raw) as RxNormDrugRecord;
      records.push(record);
    } catch (err) {
      console.warn(`  [warn] could not parse ${file}: ${String(err)}`);
    }
  }

  return records;
}

function loadInteractionBatches(): InteractionBatch[] {
  if (!fs.existsSync(INTERACTIONS_DIR)) {
    console.warn(
      `[build] Interactions data directory not found: ${INTERACTIONS_DIR}`
    );
    return [];
  }

  const files = fs
    .readdirSync(INTERACTIONS_DIR)
    .filter((f) => f.endsWith(".json"));

  const batches: InteractionBatch[] = [];

  for (const file of files) {
    const filePath = path.join(INTERACTIONS_DIR, file);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const batch = JSON.parse(raw) as InteractionBatch;
      batches.push(batch);
    } catch (err) {
      console.warn(`  [warn] could not parse ${file}: ${String(err)}`);
    }
  }

  return batches;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

interface DrugRefRow {
  rxcui: string;
  name: string;
  synonyms: string;
  drug_class: string | null;
  plain_english: string | null;
  common_sides: string;
  db_version: string;
}

function buildDrugRows(records: RxNormDrugRecord[]): DrugRefRow[] {
  // Deduplicate by rxcui — keep the record with the most data
  const byRxcui = new Map<string, RxNormDrugRecord>();

  for (const rec of records) {
    const existing = byRxcui.get(rec.rxcui);
    if (
      !existing ||
      rec.synonyms.length + rec.brandNames.length >
        existing.synonyms.length + existing.brandNames.length
    ) {
      byRxcui.set(rec.rxcui, rec);
    }
  }

  return Array.from(byRxcui.values()).map((rec) => {
    // Combine all synonyms: source name + brand names + generic names + raw synonyms
    const allSynonyms = [
      rec.sourceName,
      ...rec.brandNames,
      ...rec.genericNames,
      ...rec.synonyms,
    ].filter((s, i, arr) => {
      const normalized = s.toLowerCase().trim();
      return (
        normalized.length > 0 &&
        arr.findIndex((x) => x.toLowerCase().trim() === normalized) === i
      );
    });

    const drugClass =
      rec.drugClasses.length > 0 ? rec.drugClasses.join("; ") : null;

    return {
      rxcui: rec.rxcui,
      name: rec.name,
      synonyms: JSON.stringify(allSynonyms),
      drug_class: drugClass,
      plain_english: null, // reserved for a future enrichment pass
      common_sides: "[]", // reserved for OpenFDA adverse events pass
      db_version: DB_VERSION,
    };
  });
}

interface InteractionRow {
  rxcui_1: string;
  rxcui_2: string;
  severity: string;
  description: string;
  mechanism: string;
  management: string;
  source: string;
  db_version: string;
}

function buildInteractionRows(batches: InteractionBatch[]): InteractionRow[] {
  // Deduplicate across batches: same pair may appear in multiple batch files
  const pairMap = new Map<string, InteractionRow>();

  for (const batch of batches) {
    for (const interaction of batch.interactions) {
      const key = `${interaction.rxcui1}::${interaction.rxcui2}`;
      const existing = pairMap.get(key);

      // Keep the entry with the richer description, or higher severity
      if (!existing || interaction.description.length > existing.description.length) {
        pairMap.set(key, {
          rxcui_1: interaction.rxcui1,
          rxcui_2: interaction.rxcui2,
          severity: interaction.severity,
          description: interaction.description,
          mechanism: interaction.mechanism,
          management: interaction.management,
          source: interaction.source,
          db_version: DB_VERSION,
        });
      }
    }
  }

  return Array.from(pairMap.values());
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface BuildDbResult {
  totalDrugs: number;
  totalInteractions: number;
  dbSizeBytes: number;
  dbPath: string;
}

export async function buildDb(): Promise<BuildDbResult> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const spinner = ora("Loading fetched JSON data...").start();

  // Remove existing DB to start fresh
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  // Load all source data
  spinner.text = "Loading RxNorm records...";
  const rxnormRecords = loadRxNormRecords();
  spinner.text = `Loaded ${rxnormRecords.length} RxNorm records. Loading interactions...`;

  const interactionBatches = loadInteractionBatches();
  spinner.text = `Loaded ${interactionBatches.length} interaction batches. Building rows...`;

  const drugRows = buildDrugRows(rxnormRecords);
  const interactionRows = buildInteractionRows(interactionBatches);

  spinner.text = `Built ${drugRows.length} drug rows, ${interactionRows.length} interaction rows. Writing SQLite...`;

  // Initialize sql.js (pure JS SQLite — no native compilation needed)
  const SQL = await initSqlJs();
  const db: Database = new SQL.Database();

  // Create schema
  db.run(DDL_DRUGS);
  db.run(DDL_INTERACTIONS);
  db.run(DDL_INDEXES);

  // Insert drugs
  spinner.text = `Inserting ${drugRows.length} drugs...`;
  db.run("BEGIN TRANSACTION");
  const insertDrugSql = `
    INSERT OR REPLACE INTO drugs_ref
      (rxcui, name, synonyms, drug_class, plain_english, common_sides, db_version)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  for (const row of drugRows) {
    db.run(insertDrugSql, [
      row.rxcui, row.name, row.synonyms, row.drug_class,
      row.plain_english, row.common_sides, row.db_version,
    ]);
  }
  db.run("COMMIT");

  // Insert interactions
  spinner.text = `Inserting ${interactionRows.length} interactions...`;
  db.run("BEGIN TRANSACTION");
  const insertInteractionSql = `
    INSERT OR REPLACE INTO interactions
      (rxcui_1, rxcui_2, severity, description, mechanism, management, source, db_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  for (const row of interactionRows) {
    db.run(insertInteractionSql, [
      row.rxcui_1, row.rxcui_2, row.severity, row.description,
      row.mechanism, row.management, row.source, row.db_version,
    ]);
  }
  db.run("COMMIT");

  // Export and write to disk
  spinner.text = "Exporting database to file...";
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  db.close();

  const stats = fs.statSync(DB_PATH);
  const dbSizeBytes = stats.size;

  spinner.succeed(
    `Database built: ${drugRows.length} drugs, ${interactionRows.length} interactions — ${formatBytes(dbSizeBytes)}`
  );

  // Print stats table
  console.log("\nBuild Statistics:");
  console.log("  Drugs    :", drugRows.length.toLocaleString());
  console.log("  Interactions:", interactionRows.length.toLocaleString());
  console.log("  DB size  :", formatBytes(dbSizeBytes));
  console.log("  DB path  :", DB_PATH);
  console.log("  Version  :", DB_VERSION);

  return {
    totalDrugs: drugRows.length,
    totalInteractions: interactionRows.length,
    dbSizeBytes,
    dbPath: DB_PATH,
  };
}
