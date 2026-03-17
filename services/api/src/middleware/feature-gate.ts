/**
 * Feature gate middleware — enforces subscription tier access control.
 *
 * Three tiers:
 *   free     — 10 medications max, 1 caregiver link, 7-day dose history, no symptom tracking
 *   premium  — unlimited medications, unlimited caregivers, full history, symptom tracking, cloud sync
 *   family   — everything in premium + 5 care recipients, doctor/appointment management
 *
 * Usage:
 *   // Block route entirely unless caller is premium or family
 *   { preHandler: [verifyJwt, requireTier('premium', 'family')] }
 *
 *   // Check a per-tier count limit inside a route handler
 *   await checkMedicationLimit(userId, localId);   // throws on limit exceeded
 *   await checkCaregiverLimit(userId);             // throws on limit exceeded
 *
 * Design decisions:
 *   - requireTier fetches the user's tier from DB on every call. There is
 *     intentionally no cache here: subscription changes (e.g., a webhook
 *     downgrading from premium to free after payment failure) must take effect
 *     immediately without requiring a re-login or cache eviction.
 *   - Limit checks are separated from requireTier so they can be called
 *     inside route handlers after input validation, keeping the gate logic
 *     co-located with the write operation.
 *   - Free-tier READ operations are never gated — only write operations that
 *     would exceed limits.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/db.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'premium' | 'family';

// Tier hierarchy: family > premium > free
const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  premium: 1,
  family: 2,
};

// ─── Tier limits ──────────────────────────────────────────────────────────────

const FREE_MEDICATION_LIMIT = 10;
const FREE_CAREGIVER_LIMIT = 1;

// ─── requireTier ─────────────────────────────────────────────────────────────

/**
 * Fastify preHandler middleware factory.
 * Resolves the authenticated user's subscription tier and rejects the request
 * with 403 if their tier is not in the allowed set.
 *
 * Must be placed after verifyJwt in the preHandler array so request.user is set.
 */
export function requireTier(...allowedTiers: SubscriptionTier[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userId = request.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    });

    const rawTier = user?.subscriptionTier ?? 'free';
    // Coerce DB string to SubscriptionTier — fall back to 'free' if an unknown
    // value is stored (defensive against bad data or future tier names).
    const tier: SubscriptionTier = isSubscriptionTier(rawTier) ? rawTier : 'free';

    if (!allowedTiers.includes(tier)) {
      // Sort allowed tiers by rank and report the minimum required
      const minimumTier = allowedTiers.sort(
        (a, b) => TIER_RANK[a] - TIER_RANK[b]
      )[0] ?? 'premium';

      reply.status(403).send({
        success: false,
        error: {
          code: 'TIER_REQUIRED',
          message: `This feature requires a ${allowedTiers.join(' or ')} subscription.`,
          requiredTier: minimumTier,
          allowedTiers,
          currentTier: tier,
        },
      });
    }
  };
}

// ─── Limit check errors ───────────────────────────────────────────────────────

/**
 * Structured error thrown by limit-check functions.
 * Route handlers catch this and send the appropriate 403 response.
 */
export class TierLimitError extends Error {
  public readonly code: string;
  public readonly requiredTier: SubscriptionTier;
  public readonly currentTier: SubscriptionTier;
  public readonly limitReached: number;

  constructor(opts: {
    message: string;
    code: string;
    requiredTier: SubscriptionTier;
    currentTier: SubscriptionTier;
    limitReached: number;
  }) {
    super(opts.message);
    this.name = 'TierLimitError';
    this.code = opts.code;
    this.requiredTier = opts.requiredTier;
    this.currentTier = opts.currentTier;
    this.limitReached = opts.limitReached;
  }
}

// ─── checkMedicationLimit ─────────────────────────────────────────────────────

/**
 * Enforce the free-tier medication count limit (10 max).
 *
 * Only blocks the operation when:
 *   1. The user is on the free tier, AND
 *   2. The user already has FREE_MEDICATION_LIMIT records, AND
 *   3. The incoming localId does not already have a sync record (i.e., this
 *      is a net-new medication, not an update to an existing one).
 *
 * The POST /medications route upserts on (userId, localId). Updating an
 * existing record must not be blocked even if the user is at the limit.
 *
 * Throws TierLimitError if the limit would be exceeded.
 */
export async function checkMedicationLimit(userId: string, localId: string): Promise<void> {
  // Fetch tier and count in parallel
  const [user, existingRecord] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    }),
    prisma.medicationSync.findUnique({
      where: { userId_localId: { userId, localId } },
      select: { id: true },
    }),
  ]);

  const rawTier = user?.subscriptionTier ?? 'free';
  const tier: SubscriptionTier = isSubscriptionTier(rawTier) ? rawTier : 'free';

  // Non-free tiers have no limit
  if (tier !== 'free') return;

  // This localId already exists — this is an update, not a create. Allow it.
  if (existingRecord !== null) return;

  // Count existing medication sync records for this user
  const count = await prisma.medicationSync.count({
    where: { userId },
  });

  if (count >= FREE_MEDICATION_LIMIT) {
    throw new TierLimitError({
      message: `Free accounts are limited to ${FREE_MEDICATION_LIMIT} medications. Upgrade to Premium for unlimited medications.`,
      code: 'MEDICATION_LIMIT_REACHED',
      requiredTier: 'premium',
      currentTier: tier,
      limitReached: FREE_MEDICATION_LIMIT,
    });
  }
}

// ─── checkCaregiverLimit ──────────────────────────────────────────────────────

/**
 * Enforce the free-tier caregiver relationship limit (1 max).
 *
 * Counts relationships where the user is the patient and the status is
 * 'pending' or 'accepted'. A pending invite occupies the slot because it
 * can be accepted at any time. Revoked and expired relationships are excluded
 * as they no longer represent an active caregiver link.
 *
 * Throws TierLimitError if the limit would be exceeded.
 */
export async function checkCaregiverLimit(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  });

  const rawTier = user?.subscriptionTier ?? 'free';
  const tier: SubscriptionTier = isSubscriptionTier(rawTier) ? rawTier : 'free';

  // Non-free tiers have no limit
  if (tier !== 'free') return;

  const count = await prisma.caregiverRelationship.count({
    where: {
      patientId: userId,
      status: { in: ['pending', 'accepted'] },
    },
  });

  if (count >= FREE_CAREGIVER_LIMIT) {
    throw new TierLimitError({
      message: `Free accounts are limited to ${FREE_CAREGIVER_LIMIT} caregiver link. Upgrade to Premium for unlimited caregivers.`,
      code: 'CAREGIVER_LIMIT_REACHED',
      requiredTier: 'premium',
      currentTier: tier,
      limitReached: FREE_CAREGIVER_LIMIT,
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSubscriptionTier(value: string): value is SubscriptionTier {
  return value === 'free' || value === 'premium' || value === 'family';
}
