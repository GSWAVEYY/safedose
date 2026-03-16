/**
 * Auth route schema tests — @safedose/api
 *
 * Tests the exported Zod schemas and rate limit config from src/routes/auth.ts.
 * No HTTP server needed — schemas are imported and exercised via .safeParse().
 *
 * Mocking strategy:
 * - vi.mock('../lib/db.js') — stubs out the Prisma singleton so PrismaClient
 *   is never instantiated. The schemas and rate limit constants don't touch
 *   the database; the mock only exists to allow module loading.
 * - vi.mock('../middleware/auth.js') — stubs verifyJwt to avoid @fastify/jwt
 *   decorator augmentation side-effects during import.
 *
 * Covers:
 * - registerSchema: field requirements, refinements, min-length rules
 * - loginSchema: field requirements, either-or refinement
 * - refreshSchema: token presence requirement
 * - Rate limit config: register max:10, login max:5
 */

import { describe, it, expect, vi } from 'vitest';

// Hoist mocks before any import that transitively requires Prisma or Fastify JWT.
// vi.mock calls are hoisted to the top of the file by vitest automatically.
vi.mock('../../lib/db.js', () => ({
  prisma: {},
}));

vi.mock('../../middleware/auth.js', () => ({
  verifyJwt: vi.fn(),
}));

import {
  registerSchema,
  loginSchema,
  refreshSchema,
  REGISTER_RATE_LIMIT,
  LOGIN_RATE_LIMIT,
} from '../auth.js';

// ─── registerSchema ───────────────────────────────────────────────────────────

describe('registerSchema', () => {
  it('succeeds with valid email, displayName, and password', () => {
    const result = registerSchema.safeParse({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'securepassword',
    });
    expect(result.success).toBe(true);
  });

  it('succeeds with phone instead of email', () => {
    const result = registerSchema.safeParse({
      phone: '5550001234',
      displayName: 'Bob',
      password: 'securepassword',
    });
    expect(result.success).toBe(true);
  });

  it('fails when neither email nor phone is provided', () => {
    const result = registerSchema.safeParse({
      displayName: 'Charlie',
      password: 'securepassword',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Either email or phone is required');
    }
  });

  it('fails when displayName is missing', () => {
    const result = registerSchema.safeParse({
      email: 'dan@example.com',
      password: 'securepassword',
    });
    expect(result.success).toBe(false);
  });

  it('fails when password is under 8 characters', () => {
    const result = registerSchema.safeParse({
      email: 'eve@example.com',
      displayName: 'Eve',
      password: 'short',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Password must be at least 8 characters');
    }
  });

  it('fails when email format is invalid', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      displayName: 'Frank',
      password: 'securepassword',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Invalid email address');
    }
  });

  it('fails when displayName is empty string', () => {
    const result = registerSchema.safeParse({
      email: 'grace@example.com',
      displayName: '',
      password: 'securepassword',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Display name is required');
    }
  });

  it('accepts exactly 8-character password (boundary)', () => {
    const result = registerSchema.safeParse({
      email: 'henry@example.com',
      displayName: 'Henry',
      password: '12345678',
    });
    expect(result.success).toBe(true);
  });
});

// ─── loginSchema ──────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('succeeds with valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'alice@example.com',
      password: 'anypassword',
    });
    expect(result.success).toBe(true);
  });

  it('succeeds with valid phone and password', () => {
    const result = loginSchema.safeParse({
      phone: '5550001234',
      password: 'anypassword',
    });
    expect(result.success).toBe(true);
  });

  it('fails when neither email nor phone is provided', () => {
    const result = loginSchema.safeParse({
      password: 'anypassword',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Either email or phone is required');
    }
  });

  it('fails when password is missing', () => {
    const result = loginSchema.safeParse({
      email: 'alice@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('fails when password is empty string', () => {
    const result = loginSchema.safeParse({
      email: 'alice@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Password is required');
    }
  });
});

// ─── refreshSchema ────────────────────────────────────────────────────────────

describe('refreshSchema', () => {
  it('succeeds with a non-empty refreshToken string', () => {
    const result = refreshSchema.safeParse({
      refreshToken: 'a'.repeat(64),
    });
    expect(result.success).toBe(true);
  });

  it('fails when refreshToken is missing', () => {
    const result = refreshSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('fails when refreshToken is an empty string', () => {
    const result = refreshSchema.safeParse({ refreshToken: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Refresh token is required');
    }
  });
});

// ─── Rate limit config ────────────────────────────────────────────────────────

describe('rate limit configuration', () => {
  it('register route has max: 10 rate limit', () => {
    expect(REGISTER_RATE_LIMIT.max).toBe(10);
  });

  it('register route rate limit window is 1 minute', () => {
    expect(REGISTER_RATE_LIMIT.timeWindow).toBe('1 minute');
  });

  it('login route has max: 5 rate limit (stricter than register)', () => {
    expect(LOGIN_RATE_LIMIT.max).toBe(5);
  });

  it('login rate limit is stricter than register rate limit', () => {
    expect(LOGIN_RATE_LIMIT.max).toBeLessThan(REGISTER_RATE_LIMIT.max);
  });
});
