/**
 * Cryptographic utilities for SafeDose API.
 *
 * Provides SHA-256 checksum generation and secure token generation.
 * Encryption/decryption of medication sync payloads is handled client-side.
 */

import { createHash, randomBytes } from 'crypto';

/**
 * Generate a SHA-256 checksum of a string payload.
 * Used to verify sync payload integrity.
 */
export function sha256(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Generate a cryptographically secure random token.
 * @param byteLength — defaults to 16 (128-bit)
 */
export function generateSecureToken(byteLength: number = 16): string {
  return randomBytes(byteLength).toString('hex');
}
