/**
 * types.ts
 *
 * Domain types for the on-device drug interaction engine.
 *
 * InteractionSeverity intentionally omits 'unknown' — the DB may store it,
 * but the engine normalises unknown rows to 'minor' before returning them
 * to consumers, so UI code never needs to handle the raw DB value.
 */

export type InteractionSeverity =
  | 'contraindicated'
  | 'major'
  | 'moderate'
  | 'minor';

/** A single drug-drug interaction pair with full clinical detail. */
export interface DrugInteraction {
  rxcui1: string;
  rxcui2: string;
  drug1Name: string;
  drug2Name: string;
  severity: InteractionSeverity;
  description: string;
  mechanism: string;
  management: string;
  source: string;
}

/** Result returned by every public check function on the engine. */
export interface InteractionCheckResult {
  hasInteractions: boolean;
  interactions: DrugInteraction[];
  /** Highest severity found across all interactions, or null when none exist. */
  highestSeverity: InteractionSeverity | null;
  /** Unix timestamp (ms) of when the check completed. */
  checkedAt: number;
}

/** A drug record as returned by search / lookup functions. */
export interface DrugSearchResult {
  rxcui: string;
  name: string;
  synonyms: string[];
  drugClass: string | null;
  plainEnglish: string | null;
}

/** Version metadata returned by getDatabaseVersion(). */
export interface DrugDatabaseVersion {
  version: string;
}
