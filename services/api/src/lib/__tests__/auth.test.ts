/**
 * Auth utility tests — @safedose/api
 *
 * Tests the pure crypto functions in src/lib/auth.ts.
 * No mocking needed: hashPassword, verifyPassword, generateRefreshToken,
 * hashRefreshToken, and generateQrToken are all deterministic or
 * verifiable without a running server.
 *
 * NOTE: bcrypt with 12 rounds is intentionally slow (~200ms per hash).
 * Vitest's default per-test timeout is 5000ms — sufficient for these tests.
 */

import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateRefreshToken,
  hashRefreshToken,
  generateQrToken,
  REFRESH_TOKEN_TTL_MS,
} from '../auth.js';

// ─── hashPassword ─────────────────────────────────────────────────────────────

describe('hashPassword', () => {
  it('produces a bcrypt hash string', async () => {
    const hash = await hashPassword('hunter2');
    // bcrypt hashes always start with $2b$ (version 2b) and are 60 chars
    expect(hash).toMatch(/^\$2b\$12\$/);
    expect(hash).toHaveLength(60);
  });

  it('produces a different hash each call for the same password (salt randomness)', async () => {
    const hash1 = await hashPassword('samepassword');
    const hash2 = await hashPassword('samepassword');
    expect(hash1).not.toEqual(hash2);
  });
});

// ─── verifyPassword ───────────────────────────────────────────────────────────

describe('verifyPassword', () => {
  it('returns true when password matches the hash', async () => {
    const password = 'correct-horse-battery-staple';
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it('returns false when password does not match the hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    const result = await verifyPassword('wrong-password', hash);
    expect(result).toBe(false);
  });

  it('returns false for an invalid bcrypt hash string', async () => {
    // The login route uses a dummy hash for constant-time comparison —
    // this must resolve to false, not throw.
    const dummyHash = '$2b$12$invalidhashpaddingtomatchbcryptoutputlength1234567890';
    const result = await verifyPassword('anypassword', dummyHash);
    expect(result).toBe(false);
  });
});

// ─── generateRefreshToken ─────────────────────────────────────────────────────

describe('generateRefreshToken', () => {
  it('returns an object with raw and hash string properties', () => {
    const { raw, hash } = generateRefreshToken();
    expect(typeof raw).toBe('string');
    expect(typeof hash).toBe('string');
  });

  it('raw token is a 64-character hex string (256 bits)', () => {
    const { raw } = generateRefreshToken();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash is a 64-character hex SHA-256 string', () => {
    const { hash } = generateRefreshToken();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('raw and hash are different values', () => {
    const { raw, hash } = generateRefreshToken();
    expect(raw).not.toEqual(hash);
  });

  it('each call produces a unique raw token', () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();
    expect(first.raw).not.toEqual(second.raw);
    expect(first.hash).not.toEqual(second.hash);
  });
});

// ─── hashRefreshToken ─────────────────────────────────────────────────────────

describe('hashRefreshToken', () => {
  it('produces the same hash for the same input (deterministic)', () => {
    const raw = 'a'.repeat(64);
    const hash1 = hashRefreshToken(raw);
    const hash2 = hashRefreshToken(raw);
    expect(hash1).toEqual(hash2);
  });

  it('produces a different hash for different inputs', () => {
    const hash1 = hashRefreshToken('aaaa');
    const hash2 = hashRefreshToken('bbbb');
    expect(hash1).not.toEqual(hash2);
  });

  it('hash matches the hash returned by generateRefreshToken for the same raw token', () => {
    const { raw, hash } = generateRefreshToken();
    expect(hashRefreshToken(raw)).toEqual(hash);
  });
});

// ─── generateQrToken ─────────────────────────────────────────────────────────

describe('generateQrToken', () => {
  it('returns a 32-character hex string (128 bits)', () => {
    const token = generateQrToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('each call returns a unique token', () => {
    const first = generateQrToken();
    const second = generateQrToken();
    expect(first).not.toEqual(second);
  });
});

// ─── REFRESH_TOKEN_TTL_MS ─────────────────────────────────────────────────────

describe('REFRESH_TOKEN_TTL_MS', () => {
  it('is exactly 7 days in milliseconds', () => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(REFRESH_TOKEN_TTL_MS).toBe(sevenDaysMs);
  });
});
