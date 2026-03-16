/**
 * Crypto module tests — apps/mobile/lib/sync/crypto.ts
 *
 * Tests the AES-256-GCM key management and payload encrypt/decrypt helpers.
 *
 * Mocking strategy:
 * - expo-secure-store: replaced with an in-memory Map so we can inspect stored
 *   values without needing a native device. The Map is reset between tests to
 *   avoid state leakage.
 *
 * Web Crypto (SubtleCrypto) is available natively in Node 18+ via the global
 * `crypto` object — no polyfill or additional mocking is needed.
 *
 * Covers:
 * - getOrCreateEncryptionKey: first-call creation, idempotency
 * - generateEncryptionKey: key is persisted in SecureStore
 * - encryptPayload: output is non-empty, differs from plaintext, varies by input
 * - decryptPayload: round-trip (encrypt → decrypt === original)
 * - decryptPayload: invalid/short ciphertext throws
 * - encryptPayload + decryptPayload with edge-case inputs (empty string, large JSON)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── SecureStore mock ─────────────────────────────────────────────────────────
// Must be defined before importing the module under test. vi.mock hoisting
// ensures this factory runs before any module-level code in crypto.ts.

const secureStoreMap = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => secureStoreMap.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStoreMap.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStoreMap.delete(key);
  }),
}));

// Import after mocks are hoisted
import {
  getOrCreateEncryptionKey,
  getEncryptionKey,
  generateEncryptionKey,
  encryptPayload,
  decryptPayload,
  checksumPayload,
} from '../crypto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Clear the in-memory SecureStore between tests to isolate key state. */
function clearSecureStore(): void {
  secureStoreMap.clear();
}

// ─── Key management ───────────────────────────────────────────────────────────

describe('getOrCreateEncryptionKey', () => {
  beforeEach(() => {
    clearSecureStore();
    vi.clearAllMocks();
  });

  it('creates a new CryptoKey when no key exists in SecureStore', async () => {
    const key = await getOrCreateEncryptionKey();

    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('persists the generated key in SecureStore', async () => {
    await getOrCreateEncryptionKey();

    // The store should now contain the base64-encoded raw key bytes
    const stored = secureStoreMap.get('safedose_enc_key_v1');
    expect(stored).toBeDefined();
    expect(typeof stored).toBe('string');
    expect(stored!.length).toBeGreaterThan(0);
  });

  it('returns the same key on subsequent calls (idempotent)', async () => {
    const key1 = await getOrCreateEncryptionKey();
    const key2 = await getOrCreateEncryptionKey();

    // Both calls return a CryptoKey. We verify they produce identical
    // ciphertext structure by encrypting the same data — a shared key means
    // both can decrypt each other's output.
    const testData = { check: 'idempotent' };
    const encrypted = await encryptPayload(testData, key1);
    const decrypted = await decryptPayload<typeof testData>(encrypted, key2);

    expect(decrypted).toEqual(testData);
  });

  it('does not call setItemAsync on the second call (key reuse)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = await (import('expo-secure-store') as Promise<typeof import('expo-secure-store')>);
    const spy = vi.spyOn(SecureStore, 'setItemAsync');

    await getOrCreateEncryptionKey(); // first call — generates and stores
    const callsAfterFirst = spy.mock.calls.length;

    await getOrCreateEncryptionKey(); // second call — should reuse
    expect(spy.mock.calls.length).toBe(callsAfterFirst); // no additional store write
  });
});

describe('generateEncryptionKey', () => {
  beforeEach(() => {
    clearSecureStore();
  });

  it('stores a non-empty base64 string in SecureStore', async () => {
    await generateEncryptionKey();
    const stored = secureStoreMap.get('safedose_enc_key_v1');
    expect(stored).toBeDefined();
    expect(stored!.length).toBeGreaterThan(0);
  });

  it('overwrites any previously stored key', async () => {
    await generateEncryptionKey();
    const first = secureStoreMap.get('safedose_enc_key_v1');

    await generateEncryptionKey();
    const second = secureStoreMap.get('safedose_enc_key_v1');

    // Both should be valid non-empty base64, but they will be different key material
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    // AES-256 generates 32 random bytes each time — extremely unlikely to match
    expect(first).not.toBe(second);
  });
});

describe('getEncryptionKey', () => {
  beforeEach(() => {
    clearSecureStore();
  });

  it('returns null when SecureStore is empty', async () => {
    const key = await getEncryptionKey();
    expect(key).toBeNull();
  });

  it('returns a CryptoKey after generateEncryptionKey has been called', async () => {
    await generateEncryptionKey();
    const key = await getEncryptionKey();
    expect(key).not.toBeNull();
    expect(key!.algorithm.name).toBe('AES-GCM');
  });
});

// ─── encryptPayload ───────────────────────────────────────────────────────────

describe('encryptPayload', () => {
  let sharedKey: CryptoKey;

  beforeEach(async () => {
    clearSecureStore();
    sharedKey = await getOrCreateEncryptionKey();
  });

  it('returns a non-empty base64 string', async () => {
    const result = await encryptPayload({ name: 'aspirin', dose: '500mg' }, sharedKey);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('output does not contain the plaintext value', async () => {
    const payload = { secret: 'do-not-leak-me' };
    const encrypted = await encryptPayload(payload, sharedKey);

    // The base64 encoding of the ciphertext should not be decodable to the original string
    let decoded: string;
    try {
      decoded = atob(encrypted);
    } catch {
      decoded = '';
    }
    expect(decoded).not.toContain('do-not-leak-me');
  });

  it('produces different ciphertext on each call (fresh IV per encryption)', async () => {
    const payload = { dose: 'repeatable' };
    const encrypted1 = await encryptPayload(payload, sharedKey);
    const encrypted2 = await encryptPayload(payload, sharedKey);

    // AES-GCM with a fresh random IV must produce different output every time
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('encrypts an empty string payload without throwing', async () => {
    const result = await encryptPayload('', sharedKey);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('encrypts a large JSON payload', async () => {
    const largePayload = {
      medications: Array.from({ length: 100 }, (_, i) => ({
        id: `med-${i}`,
        name: `Medication ${i}`,
        dosage: `${i * 10}mg`,
        schedule: ['08:00', '12:00', '18:00'],
        notes: 'a'.repeat(200),
      })),
    };

    const result = await encryptPayload(largePayload, sharedKey);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });
});

// ─── decryptPayload ───────────────────────────────────────────────────────────

describe('decryptPayload', () => {
  let sharedKey: CryptoKey;

  beforeEach(async () => {
    clearSecureStore();
    sharedKey = await getOrCreateEncryptionKey();
  });

  it('round-trips a standard JSON payload', async () => {
    const original = { medicationId: 'abc-123', dose: '500mg', taken: true };
    const encrypted = await encryptPayload(original, sharedKey);
    const decrypted = await decryptPayload<typeof original>(encrypted, sharedKey);
    expect(decrypted).toEqual(original);
  });

  it('round-trips an empty string payload', async () => {
    const encrypted = await encryptPayload('', sharedKey);
    const decrypted = await decryptPayload<string>(encrypted, sharedKey);
    expect(decrypted).toBe('');
  });

  it('round-trips a large nested JSON payload', async () => {
    const original = {
      items: Array.from({ length: 50 }, (_, i) => ({
        id: `item-${i}`,
        value: i * 7,
        tags: ['a', 'b', 'c'],
      })),
    };
    const encrypted = await encryptPayload(original, sharedKey);
    const decrypted = await decryptPayload<typeof original>(encrypted, sharedKey);
    expect(decrypted).toEqual(original);
  });

  it('throws when ciphertext is too short to contain a valid IV', async () => {
    // Anything shorter than 13 bytes (12 IV + 1 ciphertext) must be rejected
    const tooShort = btoa('short');
    await expect(decryptPayload(tooShort, sharedKey)).rejects.toThrow(
      'Ciphertext is too short to contain a valid IV'
    );
  });

  it('throws when ciphertext is corrupted (tampered bytes)', async () => {
    const original = { data: 'tamper-test' };
    const encrypted = await encryptPayload(original, sharedKey);

    // Flip a byte in the middle of the base64 payload
    const bytes = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    // Modify a byte in the ciphertext region (after the 12-byte IV)
    bytes[20] = bytes[20] ^ 0xff;
    const tampered = btoa(String.fromCharCode(...bytes));

    await expect(decryptPayload(tampered, sharedKey)).rejects.toThrow();
  });

  it('throws when attempting to decrypt with a different key', async () => {
    clearSecureStore();
    const key1 = await getOrCreateEncryptionKey();
    const encrypted = await encryptPayload({ secret: 'sensitive' }, key1);

    // Generate a second, different key
    clearSecureStore();
    const key2 = await getOrCreateEncryptionKey();

    await expect(decryptPayload(encrypted, key2)).rejects.toThrow();
  });
});

// ─── checksumPayload ─────────────────────────────────────────────────────────

describe('checksumPayload', () => {
  let sharedKey: CryptoKey;

  beforeEach(async () => {
    clearSecureStore();
    sharedKey = await getOrCreateEncryptionKey();
  });

  it('returns a 64-character hex string (SHA-256)', async () => {
    const encrypted = await encryptPayload({ test: 1 }, sharedKey);
    const checksum = await checksumPayload(encrypted);
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same checksum for the same ciphertext', async () => {
    const encrypted = await encryptPayload({ stable: true }, sharedKey);
    const checksum1 = await checksumPayload(encrypted);
    const checksum2 = await checksumPayload(encrypted);
    expect(checksum1).toBe(checksum2);
  });

  it('returns a different checksum for different ciphertexts', async () => {
    const enc1 = await encryptPayload({ a: 1 }, sharedKey);
    const enc2 = await encryptPayload({ a: 1 }, sharedKey); // same data, fresh IV
    const cs1 = await checksumPayload(enc1);
    const cs2 = await checksumPayload(enc2);
    expect(cs1).not.toBe(cs2);
  });
});
