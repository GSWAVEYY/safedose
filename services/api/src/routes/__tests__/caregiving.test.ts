/**
 * Caregiving route schema + permission tests — @safedose/api
 *
 * Tests the exported Zod schemas and defaultPermissions function from
 * src/routes/caregiving.ts. No HTTP server needed — all logic is exercised
 * by importing the schemas directly and calling .safeParse().
 *
 * Mocking strategy (identical to auth.test.ts):
 * - vi.mock('../lib/db.js') — prevents PrismaClient instantiation at import time.
 *   The schemas and defaultPermissions have no database dependency; the mock
 *   exists only to satisfy the module loader.
 * - vi.mock('../lib/crypto.js') — stubs generateSecureToken so the module loads
 *   without requiring a real crypto dependency.
 * - vi.mock('../middleware/auth.js') — stubs verifyJwt to avoid @fastify/jwt
 *   decorator side-effects during import.
 *
 * Covers:
 * - inviteSchema: role requirement, email/phone requirement, valid payloads,
 *   missing both email and phone, email format validation
 * - acceptSchema: 32-char token requirement, short token rejection
 * - relationshipParamsSchema: UUID format requirement
 * - defaultPermissions: full permission matrix for primary, observer, emergency_only
 */

import { describe, it, expect, vi } from 'vitest';

// Hoist mocks before any import that transitively requires Prisma or Fastify JWT.
vi.mock('../../lib/db.js', () => ({
  prisma: {},
}));

vi.mock('../../lib/crypto.js', () => ({
  generateSecureToken: vi.fn(() => 'a'.repeat(32)),
}));

vi.mock('../../middleware/auth.js', () => ({
  verifyJwt: vi.fn(),
}));

import {
  inviteSchema,
  acceptSchema,
  relationshipParamsSchema,
  defaultPermissions,
} from '../caregiving.js';

// ─── inviteSchema ─────────────────────────────────────────────────────────────

describe('inviteSchema', () => {
  it('succeeds with email and a valid role', () => {
    const result = inviteSchema.safeParse({
      email: 'caregiver@example.com',
      role: 'primary',
    });
    expect(result.success).toBe(true);
  });

  it('succeeds with phone and a valid role', () => {
    const result = inviteSchema.safeParse({
      phone: '5551234567',
      role: 'observer',
    });
    expect(result.success).toBe(true);
  });

  it('succeeds with both email and phone provided', () => {
    const result = inviteSchema.safeParse({
      email: 'care@example.com',
      phone: '5559876543',
      role: 'emergency_only',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all three valid role values', () => {
    const roles = ['primary', 'observer', 'emergency_only'] as const;
    for (const role of roles) {
      const result = inviteSchema.safeParse({ email: 'test@example.com', role });
      expect(result.success).toBe(true);
    }
  });

  it('fails when neither email nor phone is provided', () => {
    const result = inviteSchema.safeParse({ role: 'primary' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Either email or phone is required');
    }
  });

  it('fails when role is missing', () => {
    const result = inviteSchema.safeParse({ email: 'care@example.com' });
    expect(result.success).toBe(false);
  });

  it('fails when role is an invalid value', () => {
    const result = inviteSchema.safeParse({
      email: 'care@example.com',
      role: 'admin', // not a valid role
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('role must be primary, observer, or emergency_only');
    }
  });

  it('fails when email format is invalid', () => {
    const result = inviteSchema.safeParse({
      email: 'not-an-email',
      role: 'observer',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Invalid email address');
    }
  });

  it('fails when phone is too short (under 10 chars)', () => {
    const result = inviteSchema.safeParse({
      phone: '555',
      role: 'primary',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Phone must be at least 10 digits');
    }
  });

  it('fails when all fields are empty object', () => {
    const result = inviteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── acceptSchema ─────────────────────────────────────────────────────────────

describe('acceptSchema', () => {
  it('succeeds with a 32-character token', () => {
    const result = acceptSchema.safeParse({
      inviteToken: 'a'.repeat(32),
    });
    expect(result.success).toBe(true);
  });

  it('succeeds with a 32-character hex-like token', () => {
    const result = acceptSchema.safeParse({
      inviteToken: 'deadbeefdeadbeefdeadbeefdeadbeef',
    });
    expect(result.success).toBe(true);
  });

  it('fails when inviteToken is missing', () => {
    const result = acceptSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('fails when inviteToken is shorter than 32 characters', () => {
    const result = acceptSchema.safeParse({
      inviteToken: 'tooshort',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('inviteToken must be 32 characters');
    }
  });

  it('fails when inviteToken is longer than 32 characters', () => {
    const result = acceptSchema.safeParse({
      inviteToken: 'a'.repeat(33),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('inviteToken must be 32 characters');
    }
  });

  it('fails when inviteToken is an empty string', () => {
    const result = acceptSchema.safeParse({ inviteToken: '' });
    expect(result.success).toBe(false);
  });
});

// ─── relationshipParamsSchema ─────────────────────────────────────────────────

describe('relationshipParamsSchema', () => {
  it('succeeds with a valid UUID v4', () => {
    const result = relationshipParamsSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('fails when id is missing', () => {
    const result = relationshipParamsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('fails when id is not a UUID (plain string)', () => {
    const result = relationshipParamsSchema.safeParse({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('id must be a valid UUID');
    }
  });

  it('fails when id is a numeric string', () => {
    const result = relationshipParamsSchema.safeParse({ id: '12345' });
    expect(result.success).toBe(false);
  });
});

// ─── defaultPermissions ───────────────────────────────────────────────────────

describe('defaultPermissions — primary', () => {
  const perms = defaultPermissions('primary');

  it('grants viewMedications', () => {
    expect(perms['viewMedications']).toBe(true);
  });

  it('grants viewSchedule', () => {
    expect(perms['viewSchedule']).toBe(true);
  });

  it('grants viewDoseHistory', () => {
    expect(perms['viewDoseHistory']).toBe(true);
  });

  it('grants receiveMissedDoseAlerts', () => {
    expect(perms['receiveMissedDoseAlerts']).toBe(true);
  });

  it('grants receiveRefillAlerts', () => {
    expect(perms['receiveRefillAlerts']).toBe(true);
  });

  it('grants receiveEmergencyAlerts', () => {
    expect(perms['receiveEmergencyAlerts']).toBe(true);
  });

  it('grants editMedications (primary is the most trusted role)', () => {
    expect(perms['editMedications']).toBe(true);
  });

  it('contains exactly 7 permission keys', () => {
    expect(Object.keys(perms)).toHaveLength(7);
  });
});

describe('defaultPermissions — observer', () => {
  const perms = defaultPermissions('observer');

  it('grants viewMedications', () => {
    expect(perms['viewMedications']).toBe(true);
  });

  it('grants viewSchedule', () => {
    expect(perms['viewSchedule']).toBe(true);
  });

  it('grants viewDoseHistory', () => {
    expect(perms['viewDoseHistory']).toBe(true);
  });

  it('grants receiveMissedDoseAlerts', () => {
    expect(perms['receiveMissedDoseAlerts']).toBe(true);
  });

  it('does NOT grant receiveRefillAlerts', () => {
    expect(perms['receiveRefillAlerts']).toBe(false);
  });

  it('grants receiveEmergencyAlerts', () => {
    expect(perms['receiveEmergencyAlerts']).toBe(true);
  });

  it('does NOT grant editMedications (observer is read-only)', () => {
    expect(perms['editMedications']).toBe(false);
  });
});

describe('defaultPermissions — emergency_only', () => {
  const perms = defaultPermissions('emergency_only');

  it('does NOT grant viewMedications', () => {
    expect(perms['viewMedications']).toBe(false);
  });

  it('does NOT grant viewSchedule', () => {
    expect(perms['viewSchedule']).toBe(false);
  });

  it('does NOT grant viewDoseHistory', () => {
    expect(perms['viewDoseHistory']).toBe(false);
  });

  it('does NOT grant receiveMissedDoseAlerts', () => {
    expect(perms['receiveMissedDoseAlerts']).toBe(false);
  });

  it('does NOT grant receiveRefillAlerts', () => {
    expect(perms['receiveRefillAlerts']).toBe(false);
  });

  it('ONLY grants receiveEmergencyAlerts', () => {
    expect(perms['receiveEmergencyAlerts']).toBe(true);
  });

  it('does NOT grant editMedications', () => {
    expect(perms['editMedications']).toBe(false);
  });
});

describe('defaultPermissions — role comparison invariants', () => {
  it('primary has strictly more permissions than observer', () => {
    const primary = defaultPermissions('primary');
    const observer = defaultPermissions('observer');

    // Every permission observer has, primary also has
    for (const [key, value] of Object.entries(observer)) {
      if (value === true) {
        expect(primary[key]).toBe(true);
      }
    }

    // Primary has at least one additional permission observer does not
    const primaryOnly = Object.entries(primary).filter(
      ([key, val]) => val === true && observer[key] === false
    );
    expect(primaryOnly.length).toBeGreaterThan(0);
  });

  it('observer has strictly more permissions than emergency_only', () => {
    const observer = defaultPermissions('observer');
    const emergency = defaultPermissions('emergency_only');

    const observerOnly = Object.entries(observer).filter(
      ([key, val]) => val === true && emergency[key] === false
    );
    expect(observerOnly.length).toBeGreaterThan(0);
  });

  it('emergency_only has exactly one true permission (receiveEmergencyAlerts)', () => {
    const perms = defaultPermissions('emergency_only');
    const trueCount = Object.values(perms).filter((v) => v === true).length;
    expect(trueCount).toBe(1);
  });

  it('unknown role falls through to emergency_only defaults', () => {
    const perms = defaultPermissions('unknown_role');
    // Should behave like emergency_only (the fallback branch)
    expect(perms['receiveEmergencyAlerts']).toBe(true);
    expect(perms['editMedications']).toBe(false);
    expect(perms['viewDoseHistory']).toBe(false);
  });
});
