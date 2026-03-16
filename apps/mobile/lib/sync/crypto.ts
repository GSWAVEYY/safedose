/**
 * Client-side encryption for medication sync payloads.
 *
 * Architecture:
 * - Each user gets a device-local AES-256-GCM key, generated once and stored
 *   in expo-secure-store. It never leaves the device.
 * - Payloads are encrypted before leaving the device. The server stores only
 *   ciphertext — it cannot read medication data (zero-knowledge sync).
 * - AES-GCM provides both confidentiality and integrity. A fresh IV is
 *   generated for every encrypt call and prepended to the ciphertext so
 *   the decrypt function can recover it.
 *
 * Wire format (base64-encoded):
 *   [ 12 bytes IV | remaining bytes ciphertext ]
 *
 * Uses the Web Crypto API (SubtleCrypto), which is available in React Native
 * via the Hermes engine (no additional native modules required).
 */

import * as SecureStore from 'expo-secure-store';

const ENCRYPTION_KEY_STORE_KEY = 'safedose_enc_key_v1';

// ─── Key management ───────────────────────────────────────────────────────────

/**
 * Import a raw base64-encoded key as a CryptoKey for AES-GCM operations.
 */
async function importRawKey(rawBase64: string): Promise<CryptoKey> {
  const rawBytes = Uint8Array.from(atob(rawBase64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', rawBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Generate a new AES-256-GCM key and persist it in SecureStore.
 * Called once on first launch (or after key loss).
 */
export async function generateEncryptionKey(): Promise<void> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can persist it
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('raw', key);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE_KEY, base64);
}

/**
 * Retrieve the stored encryption key. Returns null if not yet generated.
 */
export async function getEncryptionKey(): Promise<CryptoKey | null> {
  const stored = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE_KEY).catch(() => null);
  if (!stored) return null;
  return importRawKey(stored);
}

/**
 * Get or generate the encryption key. Generates on first call.
 * Use this in the sync manager to ensure a key always exists.
 */
export async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const existing = await getEncryptionKey();
  if (existing) return existing;
  await generateEncryptionKey();
  const created = await getEncryptionKey();
  if (!created) {
    throw new Error('[crypto] Failed to generate encryption key');
  }
  return created;
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────

/**
 * AES-256-GCM encrypt a JSON-serialisable payload.
 *
 * Returns a base64 string in the format: [ 12-byte IV | ciphertext ]
 */
export async function encryptPayload(data: unknown, key: CryptoKey): Promise<string> {
  const plaintext = JSON.stringify(data);
  const encoded = new TextEncoder().encode(plaintext);

  // Fresh IV for every encryption — GCM MUST NOT reuse (key, IV) pairs
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  // Concatenate IV + ciphertext into a single buffer
  const ivAndCipher = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  ivAndCipher.set(iv, 0);
  ivAndCipher.set(new Uint8Array(ciphertext), iv.byteLength);

  return btoa(String.fromCharCode(...ivAndCipher));
}

/**
 * AES-256-GCM decrypt a base64 string produced by encryptPayload.
 * Returns the parsed JSON value.
 * Throws if decryption fails (wrong key, tampered data, or wrong IV).
 */
export async function decryptPayload<T = unknown>(
  encryptedBase64: string,
  key: CryptoKey
): Promise<T> {
  const ivAndCipher = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

  if (ivAndCipher.byteLength < 13) {
    throw new Error('[crypto] Ciphertext is too short to contain a valid IV');
  }

  const iv = ivAndCipher.slice(0, 12);
  const ciphertext = ivAndCipher.slice(12);

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

  const plaintext = new TextDecoder().decode(decrypted);
  return JSON.parse(plaintext) as T;
}

/**
 * Compute a SHA-256 checksum of the encrypted payload base64 string.
 * This is sent to the server alongside the ciphertext so the server can
 * verify that the blob it received matches what was sent.
 *
 * The checksum is over the encrypted bytes, NOT the plaintext — the server
 * never sees plaintext.
 */
export async function checksumPayload(encryptedBase64: string): Promise<string> {
  const bytes = new TextEncoder().encode(encryptedBase64);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
