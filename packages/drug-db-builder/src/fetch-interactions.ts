/**
 * fetch-interactions.ts
 *
 * Downloads drug-drug interaction data from the RxNorm Interaction API.
 * Takes all RxCUIs collected by fetch-rxnorm and queries the NLM interaction
 * endpoint in batches of 50, checking all pairs within each batch.
 *
 * API docs: https://rxnav.nlm.nih.gov/InteractionAPIs.html
 * Endpoint: GET /interaction/list.json?rxcuis={rxcui1}+{rxcui2}+...
 *
 * Rate limit: 20 req/sec max (NLM policy).
 * Idempotent: already-fetched batch files are skipped.
 * Output: data/interactions/batch_{n}.json per batch
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ora from "ora";
import {
  RateLimiter,
  ProgressTracker,
  fetchJson,
  chunk,
} from "./utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data/interactions");
const BASE_URL = "https://rxnav.nlm.nih.gov/REST";

const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// RxNorm Interaction API response shapes
// ---------------------------------------------------------------------------

interface InteractionPair {
  interactionConcept?: Array<{
    minConceptItem?: {
      rxcui: string;
      name: string;
      tty?: string;
    };
    sourceConceptItem?: {
      id: string;
      name: string;
      url?: string;
    };
  }>;
  severity?: string;
  description?: string;
  comment?: string;
}

interface InteractionTypeEntry {
  minConcept?: Array<{
    rxcui: string;
    name: string;
    tty?: string;
  }>;
  interactionPair?: InteractionPair[];
  sourceName?: string;
  comment?: string;
}

interface InteractionListResponse {
  nlmDisclaimer?: string;
  interactionTypeGroup?: Array<{
    sourceDisclaimer?: string;
    sourceName?: string;
    interactionType?: InteractionTypeEntry[];
  }>;
}

// ---------------------------------------------------------------------------
// Canonical shape saved to disk
// ---------------------------------------------------------------------------

export interface NormalizedInteraction {
  rxcui1: string;
  name1: string;
  rxcui2: string;
  name2: string;
  severity: SeverityLevel;
  description: string;
  mechanism: string;
  management: string;
  source: string;
}

export type SeverityLevel =
  | "contraindicated"
  | "major"
  | "moderate"
  | "minor"
  | "unknown";

export interface InteractionBatch {
  batchIndex: number;
  rxcuis: string[];
  interactions: NormalizedInteraction[];
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Severity mapping
// ---------------------------------------------------------------------------

/**
 * Map the free-text severity strings returned by NLM to our 4-level enum.
 * NLM uses strings like "N/A", "high", "moderate", "low", or numeric.
 */
function parseSeverity(raw: string | undefined): SeverityLevel {
  if (!raw) return "unknown";

  const normalized = raw.toLowerCase().trim();

  // Contraindicated
  if (
    normalized.includes("contraindicated") ||
    normalized.includes("contraindication") ||
    normalized === "c/i"
  ) {
    return "contraindicated";
  }

  // Major / High
  if (
    normalized === "high" ||
    normalized === "major" ||
    normalized === "severe" ||
    normalized === "serious" ||
    normalized === "4" ||
    normalized === "5"
  ) {
    return "major";
  }

  // Moderate
  if (
    normalized === "moderate" ||
    normalized === "medium" ||
    normalized === "3"
  ) {
    return "moderate";
  }

  // Minor / Low
  if (
    normalized === "low" ||
    normalized === "minor" ||
    normalized === "minimal" ||
    normalized === "1" ||
    normalized === "2"
  ) {
    return "minor";
  }

  // Default: treat as moderate to avoid under-warning
  return "moderate";
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

/**
 * Extract normalized interaction pairs from the raw API response.
 * A single response may include data from multiple interaction sources
 * (DrugBank, ONCHigh, etc.) — we deduplicate on (rxcui1, rxcui2) pairs,
 * keeping the highest severity found for that pair.
 */
function parseInteractions(
  response: InteractionListResponse,
  batchRxcuis: string[]
): NormalizedInteraction[] {
  const pairMap = new Map<string, NormalizedInteraction>();

  const groups = response.interactionTypeGroup ?? [];

  for (const group of groups) {
    const sourceName = group.sourceName ?? "RxNorm";
    const types = group.interactionType ?? [];

    for (const type of types) {
      const pairs = type.interactionPair ?? [];

      for (const pair of pairs) {
        const concepts = pair.interactionConcept ?? [];
        if (concepts.length < 2) continue;

        const c1 = concepts[0]!;
        const c2 = concepts[1]!;

        const rxcui1 = c1.minConceptItem?.rxcui;
        const rxcui2 = c2.minConceptItem?.rxcui;

        if (!rxcui1 || !rxcui2) continue;

        // Only include interactions where both drugs are in our batch
        if (
          !batchRxcuis.includes(rxcui1) ||
          !batchRxcuis.includes(rxcui2)
        ) {
          continue;
        }

        const name1 = c1.minConceptItem?.name ?? rxcui1;
        const name2 = c2.minConceptItem?.name ?? rxcui2;

        // Canonical key: always sort to lower string first for dedup
        const [canonRxcui1, canonName1, canonRxcui2, canonName2] =
          rxcui1 < rxcui2
            ? [rxcui1, name1, rxcui2, name2]
            : [rxcui2, name2, rxcui1, name1];

        const pairKey = `${canonRxcui1}::${canonRxcui2}`;
        const severity = parseSeverity(pair.severity);
        const description = pair.description ?? "";
        const management = pair.comment ?? "";

        const existing = pairMap.get(pairKey);

        // Keep the highest severity across sources
        if (!existing || severityRank(severity) > severityRank(existing.severity)) {
          pairMap.set(pairKey, {
            rxcui1: canonRxcui1,
            name1: canonName1,
            rxcui2: canonRxcui2,
            name2: canonName2,
            severity,
            description,
            mechanism: "",
            management,
            source: sourceName,
          });
        }
      }
    }
  }

  return Array.from(pairMap.values());
}

function severityRank(s: SeverityLevel): number {
  switch (s) {
    case "contraindicated":
      return 4;
    case "major":
      return 3;
    case "moderate":
      return 2;
    case "minor":
      return 1;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface FetchInteractionsResult {
  totalInteractions: number;
  batchesProcessed: number;
  batchesSkipped: number;
  failed: number;
}

/**
 * Fetch all drug-drug interactions for the collected RxCUIs.
 * Processes drugs in batches of BATCH_SIZE (50).
 * Idempotent — already-fetched batch files are skipped.
 */
export async function fetchInteractions(
  rxcuis: string[]
): Promise<FetchInteractionsResult> {
  if (rxcuis.length === 0) {
    console.warn("[interactions] No RxCUIs provided — skipping.");
    return { totalInteractions: 0, batchesProcessed: 0, batchesSkipped: 0, failed: 0 };
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const limiter = new RateLimiter({ requestsPerSecond: 20 });
  const batches = chunk(rxcuis, BATCH_SIZE);
  const progress = new ProgressTracker(batches.length, "Interactions");

  let totalInteractions = 0;
  let batchesSkipped = 0;
  let failed = 0;

  const spinner = ora(`Fetching interactions for ${rxcuis.length} drugs in ${batches.length} batches...`).start();

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batchRxcuis = batches[batchIndex]!;
    const outFile = path.join(DATA_DIR, `batch_${batchIndex}.json`);

    // Idempotent: skip if already cached
    if (fs.existsSync(outFile)) {
      try {
        const cached = JSON.parse(
          fs.readFileSync(outFile, "utf-8")
        ) as InteractionBatch;
        totalInteractions += cached.interactions.length;
        batchesSkipped++;
        progress.tick(true);
        spinner.text = progress.summary();
        continue;
      } catch {
        // Corrupt — re-fetch
      }
    }

    const rxcuiList = batchRxcuis.join("+");
    const url = `${BASE_URL}/interaction/list.json?rxcuis=${rxcuiList}`;

    try {
      const raw = await fetchJson<InteractionListResponse>(url, {
        rateLimiter: limiter,
        onRetry: (attempt, err, delay) => {
          console.warn(
            `\n  [interactions] retry ${attempt} for batch ${batchIndex} — ${String(err)} (wait ${delay}ms)`
          );
        },
      });

      const interactions = parseInteractions(raw, batchRxcuis);

      const record: InteractionBatch = {
        batchIndex,
        rxcuis: batchRxcuis,
        interactions,
        fetchedAt: new Date().toISOString(),
      };

      fs.writeFileSync(outFile, JSON.stringify(record, null, 2), "utf-8");
      totalInteractions += interactions.length;
      progress.tick(true);
    } catch (err) {
      console.error(
        `\n  [error] batch ${batchIndex} failed: ${String(err)}`
      );
      failed++;
      progress.tick(false);
    }

    spinner.text = progress.summary();
  }

  spinner.succeed(`Interactions fetch complete: ${progress.summary()}`);

  return {
    totalInteractions,
    batchesProcessed: batches.length - batchesSkipped - failed,
    batchesSkipped,
    failed,
  };
}
