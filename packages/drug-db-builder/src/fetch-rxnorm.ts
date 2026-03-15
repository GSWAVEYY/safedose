/**
 * fetch-rxnorm.ts
 *
 * Downloads RxNorm drug data for the top 200 most prescribed drugs.
 * For each drug name:
 *   1. Resolve RxCUI via /drugs?name={name}
 *   2. Fetch all related concepts (brand names, generic names, drug class) via /allrelated
 *   3. Fetch drug class via /rxclass/class/byRxcui
 *
 * Rate limit: 20 req/sec max (NLM policy).
 * Idempotent: already-fetched files are skipped.
 * Output: data/rxnorm/{rxcui}.json per drug
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ora from "ora";
import { TOP_200_DRUGS } from "./drug-list.js";
import {
  RateLimiter,
  ProgressTracker,
  fetchJson,
  chunk,
  dedupeStrings,
} from "./utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data/rxnorm");
const BASE_URL = "https://rxnav.nlm.nih.gov/REST";
const RXCLASS_URL = "https://rxnav.nlm.nih.gov/REST/rxclass";

// ---------------------------------------------------------------------------
// RxNorm API response shapes
// ---------------------------------------------------------------------------

interface RxNormDrugGroup {
  drugGroup?: {
    conceptGroup?: Array<{
      tty?: string;
      conceptProperties?: Array<{
        rxcui: string;
        name: string;
        synonym?: string;
        tty?: string;
        language?: string;
        suppress?: string;
        umlscui?: string;
      }>;
    }>;
  };
}

interface RxNormAllRelated {
  allRelatedGroup?: {
    conceptGroup?: Array<{
      tty?: string;
      conceptProperties?: Array<{
        rxcui: string;
        name: string;
        synonym?: string;
        tty?: string;
        language?: string;
        suppress?: string;
        umlscui?: string;
      }>;
    }>;
  };
}

interface RxClassByRxcui {
  rxclassDrugInfoList?: {
    rxclassDrugInfo?: Array<{
      rxclassMinConceptItem?: {
        classId: string;
        className: string;
        classType: string;
      };
      rela?: string;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Canonical shape saved to disk
// ---------------------------------------------------------------------------

export interface RxNormDrugRecord {
  rxcui: string;
  name: string;
  /** Brand names (TTY=BN) */
  brandNames: string[];
  /** Generic ingredient names (TTY=IN, MIN) */
  genericNames: string[];
  /** All synonym strings from the API */
  synonyms: string[];
  /** Drug class names (ATC/EPC/MOA) */
  drugClasses: string[];
  /** Raw source drug name used to look this up */
  sourceName: string;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Core fetch functions
// ---------------------------------------------------------------------------

/**
 * Resolve the primary RxCUI for a drug name.
 * Returns null if the drug is not found.
 */
async function resolveRxcui(
  name: string,
  limiter: RateLimiter
): Promise<string | null> {
  const encoded = encodeURIComponent(name);
  const url = `${BASE_URL}/drugs.json?name=${encoded}`;

  const data = await fetchJson<RxNormDrugGroup>(url, {
    rateLimiter: limiter,
    onRetry: (attempt, err, delay) => {
      console.warn(
        `  [rxcui] retry ${attempt} for "${name}" — ${String(err)} (wait ${delay}ms)`
      );
    },
  });

  const groups = data.drugGroup?.conceptGroup ?? [];

  // Prefer IN (ingredient) TTY first, then BN, then any
  for (const preferredTty of ["IN", "MIN", "PIN", "BN"]) {
    for (const group of groups) {
      if (group.tty === preferredTty) {
        const props = group.conceptProperties ?? [];
        const active = props.filter((p) => p.suppress !== "O");
        if (active.length > 0) {
          // Pick the first — for single-ingredient drugs this is deterministic
          return active[0]!.rxcui;
        }
      }
    }
  }

  // Fallback: take any non-suppressed concept
  for (const group of groups) {
    const props = group.conceptProperties ?? [];
    const active = props.filter((p) => p.suppress !== "O");
    if (active.length > 0) {
      return active[0]!.rxcui;
    }
  }

  return null;
}

/**
 * Fetch all related concepts for an RxCUI (brand names, generics, etc.)
 */
async function fetchAllRelated(
  rxcui: string,
  limiter: RateLimiter
): Promise<RxNormAllRelated> {
  const url = `${BASE_URL}/rxcui/${rxcui}/allrelated.json`;
  return fetchJson<RxNormAllRelated>(url, {
    rateLimiter: limiter,
    onRetry: (attempt, err, delay) => {
      console.warn(
        `  [allrelated] retry ${attempt} for rxcui=${rxcui} — ${String(err)} (wait ${delay}ms)`
      );
    },
  });
}

/**
 * Fetch drug class for an RxCUI via RxClass API.
 */
async function fetchDrugClass(
  rxcui: string,
  limiter: RateLimiter
): Promise<string[]> {
  // relas=has_EPC picks Established Pharmacologic Class (preferred for display)
  const url = `${RXCLASS_URL}/class/byRxcui.json?rxcui=${rxcui}&relaSource=ATC`;

  const data = await fetchJson<RxClassByRxcui>(url, {
    rateLimiter: limiter,
    onRetry: (attempt, err, delay) => {
      console.warn(
        `  [rxclass] retry ${attempt} for rxcui=${rxcui} — ${String(err)} (wait ${delay}ms)`
      );
    },
  });

  const infos = data.rxclassDrugInfoList?.rxclassDrugInfo ?? [];
  return dedupeStrings(
    infos
      .map((i) => i.rxclassMinConceptItem?.className)
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
  );
}

/**
 * Build a full RxNormDrugRecord for a given name + RxCUI.
 */
async function buildDrugRecord(
  sourceName: string,
  rxcui: string,
  limiter: RateLimiter
): Promise<RxNormDrugRecord> {
  const [related, drugClasses] = await Promise.all([
    fetchAllRelated(rxcui, limiter),
    fetchDrugClass(rxcui, limiter),
  ]);

  const brandNames: string[] = [];
  const genericNames: string[] = [];
  const synonyms: string[] = [];
  let canonicalName = sourceName;

  const groups = related.allRelatedGroup?.conceptGroup ?? [];

  for (const group of groups) {
    const tty = group.tty ?? "";
    const props = group.conceptProperties ?? [];
    const active = props.filter((p) => p.suppress !== "O");

    for (const prop of active) {
      // Collect all synonyms
      if (prop.name) synonyms.push(prop.name);
      if (prop.synonym) synonyms.push(prop.synonym);

      switch (tty) {
        case "BN": // Brand name
        case "BPCK": // Branded pack
          if (prop.name) brandNames.push(prop.name);
          break;
        case "IN": // Ingredient
        case "MIN": // Multiple ingredients
        case "PIN": // Precise ingredient
          if (prop.name) genericNames.push(prop.name);
          // Use first IN as canonical name
          if (tty === "IN" && canonicalName === sourceName) {
            canonicalName = prop.name;
          }
          break;
        default:
          break;
      }
    }
  }

  return {
    rxcui,
    name: canonicalName,
    brandNames: dedupeStrings(brandNames).slice(0, 30), // cap brand name explosion
    genericNames: dedupeStrings(genericNames),
    synonyms: dedupeStrings(synonyms).slice(0, 50),
    drugClasses,
    sourceName,
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface FetchRxNormResult {
  succeeded: number;
  failed: number;
  skipped: number;
  rxcuiMap: Map<string, string>; // sourceName -> rxcui
}

/**
 * Download RxNorm data for all drugs in the top-200 list.
 * Skips drugs that already have a cached JSON file.
 */
export async function fetchRxNorm(): Promise<FetchRxNormResult> {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const limiter = new RateLimiter({ requestsPerSecond: 20 });
  const progress = new ProgressTracker(TOP_200_DRUGS.length, "RxNorm");
  const rxcuiMap = new Map<string, string>();

  let skipped = 0;
  let failed = 0;

  const spinner = ora("Resolving RxCUIs...").start();

  // Process in chunks of 10 to allow some parallelism while respecting rate limit
  const drugChunks = chunk(TOP_200_DRUGS, 10);

  for (const drugChunk of drugChunks) {
    await Promise.all(
      drugChunk.map(async (name) => {
        const outFile = path.join(DATA_DIR, `${sanitizeFilename(name)}.json`);

        // Idempotent: skip if already cached
        if (fs.existsSync(outFile)) {
          try {
            const cached = JSON.parse(
              fs.readFileSync(outFile, "utf-8")
            ) as RxNormDrugRecord;
            rxcuiMap.set(name, cached.rxcui);
            skipped++;
            progress.tick(true);
            return;
          } catch {
            // Corrupt cache — re-fetch
          }
        }

        try {
          const rxcui = await resolveRxcui(name, limiter);

          if (!rxcui) {
            console.warn(`\n  [warn] no RxCUI found for "${name}" — skipping`);
            failed++;
            progress.tick(false);
            return;
          }

          const record = await buildDrugRecord(name, rxcui, limiter);
          fs.writeFileSync(outFile, JSON.stringify(record, null, 2), "utf-8");
          rxcuiMap.set(name, rxcui);
          progress.tick(true);
        } catch (err) {
          console.error(`\n  [error] failed to fetch "${name}": ${String(err)}`);
          failed++;
          progress.tick(false);
        }

        spinner.text = progress.summary();
      })
    );
  }

  spinner.succeed(`RxNorm fetch complete: ${progress.summary()}`);

  return {
    succeeded: progress.done - failed - skipped,
    failed,
    skipped,
    rxcuiMap,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "_");
}
