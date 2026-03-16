/**
 * Shared DB utilities — ID generation and type helpers.
 *
 * We intentionally avoid a shared-utils package dependency here because
 * the mobile app does not have @safedose/shared-utils in its package.json.
 * A 21-char alphanumeric ID from timestamp + random gives enough local
 * uniqueness before server reconciliation assigns permanent IDs.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a URL-safe random ID.
 * 21 characters from a 62-char alphabet ≈ 125 bits of entropy.
 * Suitable for device-local primary keys before server sync.
 */
export function generateId(): string {
  const bytes = new Uint8Array(21);
  // React Native exposes crypto.getRandomValues globally via the Hermes runtime.
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join('');
}

/**
 * Current time as Unix milliseconds.
 * Centralised so tests can easily mock it.
 */
export function now(): number {
  return Date.now();
}
