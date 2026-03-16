/**
 * engine.test.ts
 *
 * Unit tests for the on-device drug interaction engine.
 *
 * Mocking strategy:
 * - `./drug-db` is mocked at the module level with vi.mock().  This intercepts
 *   every import of openDrugDatabase and getDrugsByRxcuis that engine.ts makes.
 *   Tests control the returned mock db object and the drugs map independently.
 * - expo-sqlite itself never runs — it is only imported by drug-db.ts which is
 *   fully replaced by the mock.
 *
 * Test data uses real-looking RxCUI strings (7-digit numeric) to be realistic,
 * but the actual values are fictional — no live DB is consulted.
 */

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';

// Mock drug-db BEFORE importing engine so engine.ts gets the mock on first import
vi.mock('../drug-db', () => ({
  openDrugDatabase: vi.fn(),
  getDrugsByRxcuis: vi.fn(),
  searchDrugByName: vi.fn(),
  getDrugByRxcui: vi.fn(),
  getDatabaseVersion: vi.fn(),
}));

// Now import the functions under test — they will receive the mocked drug-db
import {
  checkInteractions,
  checkNewMedInteractions,
  getInteractionsBetween,
  getAllInteractionsForDrug,
} from '../engine';
import type { DrugSearchResult } from '../types';

// Typed references to the mocked functions
import {
  openDrugDatabase,
  getDrugsByRxcuis,
} from '../drug-db';

const mockOpenDrugDatabase = openDrugDatabase as MockedFunction<typeof openDrugDatabase>;
const mockGetDrugsByRxcuis = getDrugsByRxcuis as MockedFunction<typeof getDrugsByRxcuis>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal DrugSearchResult for use in test drug maps. */
function makeDrug(rxcui: string, name: string): DrugSearchResult {
  return {
    rxcui,
    name,
    synonyms: [],
    drugClass: null,
    plainEnglish: null,
  };
}

/**
 * Build a mock SQLiteDatabase with a configurable getAllAsync response.
 * The mock db is typed as the minimum shape engine.ts requires.
 */
function makeMockDb(
  getAllAsyncRows: Record<string, unknown>[] = [],
): { getAllAsync: ReturnType<typeof vi.fn> } {
  return {
    getAllAsync: vi.fn().mockResolvedValue(getAllAsyncRows),
  };
}

/** A realistic interaction row as returned by the SQLite driver. */
function makeInteractionRow(
  rxcui1: string,
  rxcui2: string,
  severity: string = 'major',
) {
  return {
    rxcui_1: rxcui1,
    rxcui_2: rxcui2,
    severity,
    description: `${rxcui1} and ${rxcui2} interact`,
    mechanism: 'Pharmacokinetic',
    management: 'Monitor closely',
    source: 'NLM',
  };
}

// ---------------------------------------------------------------------------
// Setup: reset mocks before each test so state never leaks between cases
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  // Default: DB opens successfully, no drugs in map, no interaction rows
  mockOpenDrugDatabase.mockResolvedValue(makeMockDb([]) as never);
  mockGetDrugsByRxcuis.mockResolvedValue(new Map());
});

// ---------------------------------------------------------------------------
// checkInteractions
// ---------------------------------------------------------------------------

describe('checkInteractions', () => {
  it('returns no interactions for an empty RxCUI list', async () => {
    const result = await checkInteractions([]);

    expect(result.hasInteractions).toBe(false);
    expect(result.interactions).toHaveLength(0);
    expect(result.highestSeverity).toBeNull();
    expect(typeof result.checkedAt).toBe('number');
  });

  it('returns no interactions for a single RxCUI (no pairs to check)', async () => {
    const result = await checkInteractions(['1049502']);

    expect(result.hasInteractions).toBe(false);
    expect(result.interactions).toHaveLength(0);
    expect(result.highestSeverity).toBeNull();
  });

  it('returns interactions when the DB has a matching pair', async () => {
    const rxcuiA = '1049502';
    const rxcuiB = '2200632';
    const row = makeInteractionRow(rxcuiA, rxcuiB, 'major');

    mockOpenDrugDatabase.mockResolvedValue(makeMockDb([row]) as never);
    mockGetDrugsByRxcuis.mockResolvedValue(
      new Map([
        [rxcuiA, makeDrug(rxcuiA, 'Warfarin')],
        [rxcuiB, makeDrug(rxcuiB, 'Aspirin')],
      ]),
    );

    const result = await checkInteractions([rxcuiA, rxcuiB]);

    expect(result.hasInteractions).toBe(true);
    expect(result.interactions).toHaveLength(1);
    expect(result.interactions[0]?.drug1Name).toBe('Warfarin');
    expect(result.interactions[0]?.drug2Name).toBe('Aspirin');
    expect(result.interactions[0]?.severity).toBe('major');
    expect(result.highestSeverity).toBe('major');
  });

  it('always populates checkedAt as a positive Unix timestamp', async () => {
    const before = Date.now();
    const result = await checkInteractions([]);
    const after = Date.now();

    expect(result.checkedAt).toBeGreaterThanOrEqual(before);
    expect(result.checkedAt).toBeLessThanOrEqual(after);
  });

  it('does not produce a self-interaction for duplicate RxCUIs', async () => {
    // Passing the same RxCUI twice — the uniquePairs function must not pair
    // an item with itself.
    const result = await checkInteractions(['1049502', '1049502']);

    expect(result.hasInteractions).toBe(false);
    expect(result.interactions).toHaveLength(0);
  });

  it('sorts interactions by severity descending (contraindicated before major before moderate before minor)', async () => {
    const rxcuiA = '1049502';
    const rxcuiB = '2200632';
    const rxcuiC = '3300101';
    const rxcuiD = '4400202';

    const rows = [
      makeInteractionRow(rxcuiA, rxcuiB, 'minor'),
      makeInteractionRow(rxcuiA, rxcuiC, 'contraindicated'),
      makeInteractionRow(rxcuiA, rxcuiD, 'moderate'),
    ];

    mockOpenDrugDatabase.mockResolvedValue(makeMockDb(rows) as never);
    mockGetDrugsByRxcuis.mockResolvedValue(
      new Map([
        [rxcuiA, makeDrug(rxcuiA, 'DrugA')],
        [rxcuiB, makeDrug(rxcuiB, 'DrugB')],
        [rxcuiC, makeDrug(rxcuiC, 'DrugC')],
        [rxcuiD, makeDrug(rxcuiD, 'DrugD')],
      ]),
    );

    const result = await checkInteractions([rxcuiA, rxcuiB, rxcuiC, rxcuiD]);

    expect(result.interactions[0]?.severity).toBe('contraindicated');
    expect(result.interactions[1]?.severity).toBe('moderate');
    expect(result.interactions[2]?.severity).toBe('minor');
    expect(result.highestSeverity).toBe('contraindicated');
  });

  it('handles a large RxCUI list (20 items) without error', async () => {
    const rxcuis = Array.from({ length: 20 }, (_, i) => String(1000000 + i));

    // DB returns no interactions for any pair — we are testing stability only
    const result = await checkInteractions(rxcuis);

    expect(result.hasInteractions).toBe(false);
    expect(result.interactions).toHaveLength(0);
  });

  it('returns empty results gracefully when the database is unavailable (null db)', async () => {
    mockOpenDrugDatabase.mockResolvedValue(null as never);

    const result = await checkInteractions(['1049502', '2200632']);

    expect(result.hasInteractions).toBe(false);
    expect(result.interactions).toHaveLength(0);
    expect(result.highestSeverity).toBeNull();
  });

  it('falls back to RxCUI string as drug name when drug is not in the drugs map', async () => {
    const rxcuiA = '9999991';
    const rxcuiB = '9999992';

    // DB returns an interaction row but getDrugsByRxcuis returns an empty map
    mockOpenDrugDatabase.mockResolvedValue(
      makeMockDb([makeInteractionRow(rxcuiA, rxcuiB, 'moderate')]) as never,
    );
    mockGetDrugsByRxcuis.mockResolvedValue(new Map()); // no names available

    const result = await checkInteractions([rxcuiA, rxcuiB]);

    expect(result.hasInteractions).toBe(true);
    // Engine falls back to the RxCUI string itself when no name is found
    expect(result.interactions[0]?.drug1Name).toBe(rxcuiA);
    expect(result.interactions[0]?.drug2Name).toBe(rxcuiB);
  });

  it('normalises an unknown DB severity value to minor', async () => {
    const rxcuiA = '1049502';
    const rxcuiB = '2200632';

    mockOpenDrugDatabase.mockResolvedValue(
      makeMockDb([makeInteractionRow(rxcuiA, rxcuiB, 'unknown_level')]) as never,
    );
    mockGetDrugsByRxcuis.mockResolvedValue(
      new Map([
        [rxcuiA, makeDrug(rxcuiA, 'DrugA')],
        [rxcuiB, makeDrug(rxcuiB, 'DrugB')],
      ]),
    );

    const result = await checkInteractions([rxcuiA, rxcuiB]);

    expect(result.interactions[0]?.severity).toBe('minor');
  });
});

// ---------------------------------------------------------------------------
// checkNewMedInteractions
// ---------------------------------------------------------------------------

describe('checkNewMedInteractions', () => {
  it('returns no interactions when existingRxcuis is empty', async () => {
    const result = await checkNewMedInteractions('1049502', []);

    expect(result.hasInteractions).toBe(false);
    expect(result.interactions).toHaveLength(0);
    expect(result.highestSeverity).toBeNull();
    // Empty path short-circuits before the DB — openDrugDatabase should NOT be called
    expect(mockOpenDrugDatabase).not.toHaveBeenCalled();
  });

  it('returns interactions when the new drug conflicts with an existing one', async () => {
    const newRxcui = '1049502';
    const existingRxcui = '2200632';

    mockOpenDrugDatabase.mockResolvedValue(
      makeMockDb([makeInteractionRow(newRxcui, existingRxcui, 'contraindicated')]) as never,
    );
    mockGetDrugsByRxcuis.mockResolvedValue(
      new Map([
        [newRxcui, makeDrug(newRxcui, 'Warfarin')],
        [existingRxcui, makeDrug(existingRxcui, 'Aspirin')],
      ]),
    );

    const result = await checkNewMedInteractions(newRxcui, [existingRxcui]);

    expect(result.hasInteractions).toBe(true);
    expect(result.highestSeverity).toBe('contraindicated');
    expect(result.interactions[0]?.drug1Name).toBe('Warfarin');
  });

  it('returns no interactions when the new drug has no conflicts', async () => {
    mockOpenDrugDatabase.mockResolvedValue(makeMockDb([]) as never);

    const result = await checkNewMedInteractions('1049502', ['2200632', '3300101']);

    expect(result.hasInteractions).toBe(false);
    expect(result.interactions).toHaveLength(0);
  });

  it('result always has all required InteractionCheckResult fields', async () => {
    const result = await checkNewMedInteractions('1049502', []);

    // TypeScript compiles this — the runtime check verifies the shape at runtime too
    expect('hasInteractions' in result).toBe(true);
    expect('interactions' in result).toBe(true);
    expect('highestSeverity' in result).toBe(true);
    expect('checkedAt' in result).toBe(true);
    expect(Array.isArray(result.interactions)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getInteractionsBetween
// ---------------------------------------------------------------------------

describe('getInteractionsBetween', () => {
  it('returns interaction data for two known conflicting drugs', async () => {
    const rxcuiA = '1049502';
    const rxcuiB = '2200632';

    mockOpenDrugDatabase.mockResolvedValue(
      makeMockDb([makeInteractionRow(rxcuiA, rxcuiB, 'major')]) as never,
    );
    mockGetDrugsByRxcuis.mockResolvedValue(
      new Map([
        [rxcuiA, makeDrug(rxcuiA, 'Warfarin')],
        [rxcuiB, makeDrug(rxcuiB, 'Aspirin')],
      ]),
    );

    const result = await getInteractionsBetween(rxcuiA, rxcuiB);

    expect(result.hasInteractions).toBe(true);
    expect(result.interactions[0]?.severity).toBe('major');
    expect(result.interactions[0]?.description).toBeTruthy();
    expect(result.interactions[0]?.mechanism).toBeTruthy();
    expect(result.interactions[0]?.management).toBeTruthy();
    expect(result.interactions[0]?.source).toBeTruthy();
  });

  it('returns empty result for two drugs with no known interaction', async () => {
    mockOpenDrugDatabase.mockResolvedValue(makeMockDb([]) as never);

    const result = await getInteractionsBetween('1049502', '9999001');

    expect(result.hasInteractions).toBe(false);
    expect(result.highestSeverity).toBeNull();
  });

  it('returns empty result when the DB is unavailable', async () => {
    mockOpenDrugDatabase.mockResolvedValue(null as never);

    const result = await getInteractionsBetween('1049502', '2200632');

    expect(result.hasInteractions).toBe(false);
    expect(result.interactions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getAllInteractionsForDrug
// ---------------------------------------------------------------------------

describe('getAllInteractionsForDrug', () => {
  it('returns all interactions involving the drug', async () => {
    const targetRxcui = '1049502';
    const otherRxcuiA = '2200632';
    const otherRxcuiB = '3300101';

    const rows = [
      makeInteractionRow(targetRxcui, otherRxcuiA, 'major'),
      makeInteractionRow(otherRxcuiB, targetRxcui, 'moderate'),
    ];

    mockOpenDrugDatabase.mockResolvedValue(makeMockDb(rows) as never);
    mockGetDrugsByRxcuis.mockResolvedValue(
      new Map([
        [targetRxcui, makeDrug(targetRxcui, 'Warfarin')],
        [otherRxcuiA, makeDrug(otherRxcuiA, 'Aspirin')],
        [otherRxcuiB, makeDrug(otherRxcuiB, 'Ibuprofen')],
      ]),
    );

    const result = await getAllInteractionsForDrug(targetRxcui);

    expect(result.hasInteractions).toBe(true);
    expect(result.interactions).toHaveLength(2);
    // Sorted descending: major first
    expect(result.interactions[0]?.severity).toBe('major');
    expect(result.interactions[1]?.severity).toBe('moderate');
    expect(result.highestSeverity).toBe('major');
  });

  it('returns empty result when the DB is unavailable (null db)', async () => {
    mockOpenDrugDatabase.mockResolvedValue(null as never);

    const result = await getAllInteractionsForDrug('1049502');

    expect(result.hasInteractions).toBe(false);
    expect(result.interactions).toHaveLength(0);
    expect(result.highestSeverity).toBeNull();
  });

  it('returns empty result for a drug with no known interactions', async () => {
    mockOpenDrugDatabase.mockResolvedValue(makeMockDb([]) as never);

    const result = await getAllInteractionsForDrug('0000001');

    expect(result.hasInteractions).toBe(false);
    expect(result.interactions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// InteractionCheckResult shape contract
// ---------------------------------------------------------------------------

describe('InteractionCheckResult type contract', () => {
  it('always returns all four required fields regardless of code path', async () => {
    // All four public functions must return the same shape

    const results = await Promise.all([
      checkInteractions([]),
      checkInteractions(['1049502']),
      checkNewMedInteractions('1049502', []),
      getInteractionsBetween('1049502', '2200632'),
      getAllInteractionsForDrug('1049502'),
    ]);

    for (const result of results) {
      expect(typeof result.hasInteractions).toBe('boolean');
      expect(Array.isArray(result.interactions)).toBe(true);
      // highestSeverity is either a valid severity string or null
      if (result.highestSeverity !== null) {
        expect(['contraindicated', 'major', 'moderate', 'minor']).toContain(
          result.highestSeverity,
        );
      }
      expect(typeof result.checkedAt).toBe('number');
      expect(result.checkedAt).toBeGreaterThan(0);
    }
  });

  it('DrugInteraction has all required fields when an interaction is present', async () => {
    const rxcuiA = '1049502';
    const rxcuiB = '2200632';

    mockOpenDrugDatabase.mockResolvedValue(
      makeMockDb([makeInteractionRow(rxcuiA, rxcuiB, 'major')]) as never,
    );
    mockGetDrugsByRxcuis.mockResolvedValue(
      new Map([
        [rxcuiA, makeDrug(rxcuiA, 'Warfarin')],
        [rxcuiB, makeDrug(rxcuiB, 'Aspirin')],
      ]),
    );

    const result = await checkInteractions([rxcuiA, rxcuiB]);

    expect(result.interactions).toHaveLength(1);
    const interaction = result.interactions[0]!;

    expect(typeof interaction.rxcui1).toBe('string');
    expect(typeof interaction.rxcui2).toBe('string');
    expect(typeof interaction.drug1Name).toBe('string');
    expect(typeof interaction.drug2Name).toBe('string');
    expect(typeof interaction.severity).toBe('string');
    expect(typeof interaction.description).toBe('string');
    expect(typeof interaction.mechanism).toBe('string');
    expect(typeof interaction.management).toBe('string');
    expect(typeof interaction.source).toBe('string');
  });
});
