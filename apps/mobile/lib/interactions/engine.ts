/**
 * engine.ts
 *
 * On-device drug interaction check engine.
 *
 * All queries run against the bundled read-only drug database via drug-db.ts.
 * No network I/O — everything is local.
 *
 * Performance budget: 15 medications = 105 pairs.  Each pair is ONE indexed
 * lookup (rxcui_1, rxcui_2 are the composite PK).  Both orderings are checked
 * in a single UNION query per pair, but in practice the batch engine issues a
 * single query covering all pairs at once via UNION ALL, keeping total round-
 * trips to O(1) per check regardless of medication count.
 */

import { openDrugDatabase, getDrugsByRxcuis } from './drug-db';
import type {
  DrugInteraction,
  InteractionCheckResult,
  InteractionSeverity,
} from './types';

// ---------------------------------------------------------------------------
// Severity ordering (higher index = higher severity)
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<InteractionSeverity, number> = {
  minor: 1,
  moderate: 2,
  major: 3,
  contraindicated: 4,
};

/**
 * The interactions table allows 'unknown' at the DB level.
 * We normalise it to 'minor' so UI code never sees a value outside the
 * InteractionSeverity union.
 */
function normaliseSeverity(raw: string): InteractionSeverity {
  switch (raw) {
    case 'contraindicated':
    case 'major':
    case 'moderate':
    case 'minor':
      return raw;
    default:
      return 'minor';
  }
}

function highestSeverity(interactions: DrugInteraction[]): InteractionSeverity | null {
  if (interactions.length === 0) return null;

  return interactions.reduce<InteractionSeverity>((best, current) => {
    return SEVERITY_RANK[current.severity] > SEVERITY_RANK[best]
      ? current.severity
      : best;
  }, 'minor');
}

function sortBySeverityDesc(interactions: DrugInteraction[]): DrugInteraction[] {
  return [...interactions].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
}

// ---------------------------------------------------------------------------
// Internal DB row shape for interactions table
// ---------------------------------------------------------------------------

interface InteractionRow {
  rxcui_1: string;
  rxcui_2: string;
  severity: string;
  description: string;
  mechanism: string;
  management: string;
  source: string;
}

// ---------------------------------------------------------------------------
// Internal: generate all unique unordered pairs from an array
// ---------------------------------------------------------------------------

function uniquePairs(items: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      // Safe non-null assertion: loop bounds guarantee these indices exist
      pairs.push([items[i] as string, items[j] as string]);
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Internal: enrich raw DB rows with drug names and normalise severity
// ---------------------------------------------------------------------------

async function enrichRows(
  rows: InteractionRow[],
): Promise<DrugInteraction[]> {
  if (rows.length === 0) return [];

  // Collect every unique RxCUI that appears in the result set
  const rxcuiSet = new Set<string>();
  for (const row of rows) {
    rxcuiSet.add(row.rxcui_1);
    rxcuiSet.add(row.rxcui_2);
  }

  const drugMap = await getDrugsByRxcuis(Array.from(rxcuiSet));

  return rows.map((row) => ({
    rxcui1: row.rxcui_1,
    rxcui2: row.rxcui_2,
    drug1Name: drugMap.get(row.rxcui_1)?.name ?? row.rxcui_1,
    drug2Name: drugMap.get(row.rxcui_2)?.name ?? row.rxcui_2,
    severity: normaliseSeverity(row.severity),
    description: row.description,
    mechanism: row.mechanism,
    management: row.management,
    source: row.source,
  }));
}

// ---------------------------------------------------------------------------
// Internal: fetch interactions for a list of (A, B) pairs in one DB round-trip
//
// Strategy: build a single SQL statement with UNION ALL — one SELECT per pair
// checking both orderings.  SQLite query planner uses the composite PK index
// (rxcui_1, rxcui_2) for each branch, so each branch is an O(log N) point
// lookup.  105 UNION ALL branches is well within SQLite's limits and resolves
// in a single prepared statement execution.
// ---------------------------------------------------------------------------

async function fetchInteractionPairs(
  pairs: Array<[string, string]>,
): Promise<InteractionRow[]> {
  if (pairs.length === 0) return [];

  const db = await openDrugDatabase();
  if (db === null) return [];

  const selectClause = `
    SELECT rxcui_1, rxcui_2, severity, description, mechanism, management, source
      FROM interactions
     WHERE (rxcui_1 = ? AND rxcui_2 = ?)
        OR (rxcui_1 = ? AND rxcui_2 = ?)
  `;

  // For a single pair we can query directly without UNION ALL overhead
  if (pairs.length === 1) {
    const [a, b] = pairs[0] as [string, string];
    return db.getAllAsync<InteractionRow>(selectClause, [a, b, b, a]);
  }

  // Multiple pairs: build UNION ALL
  const unionClauses = pairs.map(() => selectClause).join('\nUNION ALL\n');
  const params: string[] = [];
  for (const [a, b] of pairs) {
    params.push(a, b, b, a);
  }

  return db.getAllAsync<InteractionRow>(unionClauses, params);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check all pairwise combinations of the given RxCUIs for interactions.
 * This is the primary function — call it whenever the medication list changes.
 *
 * Returns an empty result (hasInteractions: false) when:
 *   - fewer than 2 RxCUIs are provided
 *   - the bundled database is unavailable
 *   - no interactions are found
 */
export async function checkInteractions(
  rxcuis: string[],
): Promise<InteractionCheckResult> {
  const pairs = uniquePairs(rxcuis);
  const rows = await fetchInteractionPairs(pairs);
  const interactions = sortBySeverityDesc(await enrichRows(rows));

  return {
    hasInteractions: interactions.length > 0,
    interactions,
    highestSeverity: highestSeverity(interactions),
    checkedAt: Date.now(),
  };
}

/**
 * Check a single new medication against all existing ones.
 * Convenience wrapper over checkInteractions for the "add medication" flow.
 *
 * @param newRxcui       RxCUI of the medication being added
 * @param existingRxcuis RxCUIs already in the patient's medication list
 */
export async function checkNewMedInteractions(
  newRxcui: string,
  existingRxcuis: string[],
): Promise<InteractionCheckResult> {
  if (existingRxcuis.length === 0) {
    return {
      hasInteractions: false,
      interactions: [],
      highestSeverity: null,
      checkedAt: Date.now(),
    };
  }

  // Build pairs: newRxcui vs every existing med
  const pairs: Array<[string, string]> = existingRxcuis.map((existing) => [
    newRxcui,
    existing,
  ]);

  const rows = await fetchInteractionPairs(pairs);
  const interactions = sortBySeverityDesc(await enrichRows(rows));

  return {
    hasInteractions: interactions.length > 0,
    interactions,
    highestSeverity: highestSeverity(interactions),
    checkedAt: Date.now(),
  };
}

/**
 * Direct lookup of the interaction between exactly two drugs.
 * Checks both orderings (A,B and B,A).
 * Returns an empty result when no interaction exists or the DB is unavailable.
 */
export async function getInteractionsBetween(
  rxcui1: string,
  rxcui2: string,
): Promise<InteractionCheckResult> {
  const rows = await fetchInteractionPairs([[rxcui1, rxcui2]]);
  const interactions = sortBySeverityDesc(await enrichRows(rows));

  return {
    hasInteractions: interactions.length > 0,
    interactions,
    highestSeverity: highestSeverity(interactions),
    checkedAt: Date.now(),
  };
}

/**
 * All known interactions involving a single drug.
 * Queries both rxcui_1 and rxcui_2 columns to catch all stored orderings.
 */
export async function getAllInteractionsForDrug(
  rxcui: string,
): Promise<InteractionCheckResult> {
  const db = await openDrugDatabase();
  if (db === null) {
    return {
      hasInteractions: false,
      interactions: [],
      highestSeverity: null,
      checkedAt: Date.now(),
    };
  }

  const rows = await db.getAllAsync<InteractionRow>(
    `SELECT rxcui_1, rxcui_2, severity, description, mechanism, management, source
       FROM interactions
      WHERE rxcui_1 = ? OR rxcui_2 = ?`,
    [rxcui, rxcui],
  );

  const interactions = sortBySeverityDesc(await enrichRows(rows));

  return {
    hasInteractions: interactions.length > 0,
    interactions,
    highestSeverity: highestSeverity(interactions),
    checkedAt: Date.now(),
  };
}
