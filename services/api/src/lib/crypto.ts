/**
 * Cryptographic utilities for SafeDose API.
 *
 * PLACEHOLDER — Sentinel will review and harden this module.
 *
 * Planned:
 * - AES-256-GCM encryption/decryption for medication sync payloads
 * - SHA-256 checksum generation
 * - Secure token generation
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

// TODO: implement AES-256-GCM encrypt/decrypt for medication sync payloads
// encrypt(plaintext: string, key: Buffer): string
// decrypt(ciphertext: string, key: Buffer): string
