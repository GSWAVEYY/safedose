/**
 * Auth utilities for SafeDose API.
 *
 * - Password hashing via bcrypt (12 salt rounds)
 * - Access token (15min) + refresh token (7 days) generation
 * - Refresh token stored as SHA-256 hash — raw token is sent to client only
 * - Emergency QR token generation
 */

import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

// ─── Constants ────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 32; // 256-bit → 64-char hex
const QR_TOKEN_BYTES = 16;      // 128-bit → 32-char hex

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Password ─────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure refresh token.
 * Returns the raw token (sent to client) and its SHA-256 hash (stored in DB).
 */
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const hash = sha256(raw);
  return { raw, hash };
}

/**
 * Hash a raw refresh token for safe storage / lookup.
 */
export function hashRefreshToken(raw: string): string {
  return sha256(raw);
}

/**
 * Generate a random QR token for emergency cards.
 */
export function generateQrToken(): string {
  return randomBytes(QR_TOKEN_BYTES).toString('hex');
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
