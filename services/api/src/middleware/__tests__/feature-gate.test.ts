/**
 * Feature gate middleware tests — @safedose/api
 *
 * Tests the exported functions from src/middleware/feature-gate.ts.
 * All Prisma calls are mocked so no database is required.
 *
 * Mocking strategy:
 * - vi.mock('../lib/db.js') — replaces the Prisma singleton with a typed mock.
 *   Each test configures prisma.user.findUnique / count / etc. via mockResolvedValueOnce.
 *
 * Covers:
 * - TierLimitError: correct properties, extends Error, name field
 * - checkMedicationLimit:
 *     happy path (free tier, under limit, new localId)
 *     update path (free tier, at limit, but localId already exists → allow)
 *     limit reached (free tier, at limit, new localId → throws)
 *     premium tier bypasses limit entirely
 *     family tier bypasses limit entirely
 *     unknown tier treated as free
 * - checkCaregiverLimit:
 *     happy path (free tier, under limit)
 *     limit reached (free tier, at limit → throws)
 *     premium tier bypasses limit
 *     existing pending invite counts toward limit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks before imports
vi.mock('../../lib/db.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    medicationSync: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    caregiverRelationship: {
      count: vi.fn(),
    },
  },
}));

import {
  TierLimitError,
  checkMedicationLimit,
  checkCaregiverLimit,
} from '../feature-gate.js';
import { prisma } from '../../lib/db.js';

// Cast to allow per-test mockResolvedValueOnce configuration
const mockUser = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockMedSync = prisma.medicationSync.findUnique as ReturnType<typeof vi.fn>;
const mockMedCount = prisma.medicationSync.count as ReturnType<typeof vi.fn>;
const mockCaregiverCount = prisma.caregiverRelationship.count as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── TierLimitError ───────────────────────────────────────────────────────────

describe('TierLimitError', () => {
  it('is an instance of Error', () => {
    const err = new TierLimitError({
      message: 'test message',
      code: 'TEST_CODE',
      requiredTier: 'premium',
      currentTier: 'free',
      limitReached: 10,
    });
    expect(err).toBeInstanceOf(Error);
  });

  it('has name "TierLimitError"', () => {
    const err = new TierLimitError({
      message: 'test',
      code: 'MEDICATION_LIMIT_REACHED',
      requiredTier: 'premium',
      currentTier: 'free',
      limitReached: 10,
    });
    expect(err.name).toBe('TierLimitError');
  });

  it('exposes all properties correctly', () => {
    const err = new TierLimitError({
      message: 'Limit reached',
      code: 'CAREGIVER_LIMIT_REACHED',
      requiredTier: 'premium',
      currentTier: 'free',
      limitReached: 1,
    });
    expect(err.message).toBe('Limit reached');
    expect(err.code).toBe('CAREGIVER_LIMIT_REACHED');
    expect(err.requiredTier).toBe('premium');
    expect(err.currentTier).toBe('free');
    expect(err.limitReached).toBe(1);
  });
});

// ─── checkMedicationLimit ─────────────────────────────────────────────────────

describe('checkMedicationLimit — free tier, under limit, new localId', () => {
  it('resolves without throwing when count is below limit', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'free' });
    mockMedSync.mockResolvedValueOnce(null); // localId does not exist
    mockMedCount.mockResolvedValueOnce(5);   // 5 of 10 used

    await expect(checkMedicationLimit('user-1', 'local-abc')).resolves.toBeUndefined();
  });

  it('resolves without throwing when count is exactly one below limit', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'free' });
    mockMedSync.mockResolvedValueOnce(null);
    mockMedCount.mockResolvedValueOnce(9); // 9 of 10 used — still room for one more

    await expect(checkMedicationLimit('user-1', 'local-new')).resolves.toBeUndefined();
  });

  it('resolves without throwing when count is zero', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'free' });
    mockMedSync.mockResolvedValueOnce(null);
    mockMedCount.mockResolvedValueOnce(0);

    await expect(checkMedicationLimit('user-1', 'local-first')).resolves.toBeUndefined();
  });
});

describe('checkMedicationLimit — free tier, at limit, existing localId (update)', () => {
  it('resolves without throwing because it is an update, not a create', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'free' });
    // localId already exists in DB — this is an update
    mockMedSync.mockResolvedValueOnce({ id: 'existing-id' });
    // count is NOT queried in this code path

    await expect(checkMedicationLimit('user-1', 'local-existing')).resolves.toBeUndefined();
    // Verify count was never called (no DB query needed once we know it's an update)
    expect(mockMedCount).not.toHaveBeenCalled();
  });
});

describe('checkMedicationLimit — free tier, at limit, new localId (blocked)', () => {
  it('throws TierLimitError with MEDICATION_LIMIT_REACHED code', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'free' });
    mockMedSync.mockResolvedValueOnce(null); // new localId
    mockMedCount.mockResolvedValueOnce(10);  // at the 10-record limit

    await expect(checkMedicationLimit('user-1', 'local-new')).rejects.toThrow(TierLimitError);
  });

  it('error has the correct code and tier fields', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'free' });
    mockMedSync.mockResolvedValueOnce(null);
    mockMedCount.mockResolvedValueOnce(10);

    try {
      await checkMedicationLimit('user-1', 'local-new');
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(TierLimitError);
      if (err instanceof TierLimitError) {
        expect(err.code).toBe('MEDICATION_LIMIT_REACHED');
        expect(err.requiredTier).toBe('premium');
        expect(err.currentTier).toBe('free');
        expect(err.limitReached).toBe(10);
      }
    }
  });

  it('also blocks when count exceeds the limit (data inconsistency guard)', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'free' });
    mockMedSync.mockResolvedValueOnce(null);
    mockMedCount.mockResolvedValueOnce(15); // more than limit

    await expect(checkMedicationLimit('user-1', 'local-new')).rejects.toThrow(TierLimitError);
  });
});

describe('checkMedicationLimit — premium tier bypasses limit', () => {
  it('resolves without throwing and never queries the count when user is premium', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'premium' });
    // findUnique (for the localId check) is called in Promise.all alongside
    // the user fetch, so it runs. But count is never needed.
    mockMedSync.mockResolvedValueOnce(null);

    await expect(checkMedicationLimit('user-2', 'any-local-id')).resolves.toBeUndefined();
    // count must NOT be called — the early return fires after tier check
    expect(mockMedCount).not.toHaveBeenCalled();
  });
});

describe('checkMedicationLimit — family tier bypasses limit', () => {
  it('resolves without throwing and never queries the count when user is family', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'family' });
    mockMedSync.mockResolvedValueOnce(null);

    await expect(checkMedicationLimit('user-3', 'any-local-id')).resolves.toBeUndefined();
    expect(mockMedCount).not.toHaveBeenCalled();
  });
});

describe('checkMedicationLimit — unknown tier treated as free', () => {
  it('enforces free-tier limit when subscriptionTier is an unknown value', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'enterprise' }); // unknown tier
    mockMedSync.mockResolvedValueOnce(null);
    mockMedCount.mockResolvedValueOnce(10); // at limit

    await expect(checkMedicationLimit('user-4', 'local-new')).rejects.toThrow(TierLimitError);
  });

  it('allows creation when unknown tier and under the limit', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'enterprise' });
    mockMedSync.mockResolvedValueOnce(null);
    mockMedCount.mockResolvedValueOnce(3);

    await expect(checkMedicationLimit('user-4', 'local-new')).resolves.toBeUndefined();
  });
});

// ─── checkCaregiverLimit ──────────────────────────────────────────────────────

describe('checkCaregiverLimit — free tier, under limit', () => {
  it('resolves without throwing when count is zero', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'free' });
    mockCaregiverCount.mockResolvedValueOnce(0);

    await expect(checkCaregiverLimit('user-1')).resolves.toBeUndefined();
  });
});

describe('checkCaregiverLimit — free tier, at limit (blocked)', () => {
  it('throws TierLimitError when count equals 1', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'free' });
    mockCaregiverCount.mockResolvedValueOnce(1); // at the 1-caregiver limit

    await expect(checkCaregiverLimit('user-1')).rejects.toThrow(TierLimitError);
  });

  it('error has CAREGIVER_LIMIT_REACHED code and correct tier fields', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'free' });
    mockCaregiverCount.mockResolvedValueOnce(1);

    try {
      await checkCaregiverLimit('user-1');
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(TierLimitError);
      if (err instanceof TierLimitError) {
        expect(err.code).toBe('CAREGIVER_LIMIT_REACHED');
        expect(err.requiredTier).toBe('premium');
        expect(err.currentTier).toBe('free');
        expect(err.limitReached).toBe(1);
      }
    }
  });

  it('also blocks when count exceeds the limit', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'free' });
    mockCaregiverCount.mockResolvedValueOnce(3); // more than limit

    await expect(checkCaregiverLimit('user-1')).rejects.toThrow(TierLimitError);
  });
});

describe('checkCaregiverLimit — premium tier bypasses limit', () => {
  it('resolves without DB count query when user is premium', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'premium' });

    await expect(checkCaregiverLimit('user-2')).resolves.toBeUndefined();
    expect(mockCaregiverCount).not.toHaveBeenCalled();
  });
});

describe('checkCaregiverLimit — family tier bypasses limit', () => {
  it('resolves without DB count query when user is family', async () => {
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'family' });

    await expect(checkCaregiverLimit('user-3')).resolves.toBeUndefined();
    expect(mockCaregiverCount).not.toHaveBeenCalled();
  });
});

describe('checkCaregiverLimit — pending invite counts toward limit', () => {
  it('blocks when there is one pending invite (not yet accepted)', async () => {
    // The query includes status: { in: ['pending', 'accepted'] }
    // so a pending invite occupies the free-tier slot.
    mockUser.mockResolvedValueOnce({ subscriptionTier: 'free' });
    mockCaregiverCount.mockResolvedValueOnce(1); // 1 pending relationship

    await expect(checkCaregiverLimit('user-1')).rejects.toThrow(TierLimitError);
  });
});
