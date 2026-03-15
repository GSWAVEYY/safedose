import { nanoid } from 'nanoid';

/**
 * Generate a URL-safe unique ID.
 * Default length 21 chars — collision-safe for local IDs.
 */
export function generateId(size?: number): string {
  return nanoid(size);
}

/**
 * Generate a short token suitable for QR codes and invite links.
 * 12 chars — ~72 bits of entropy.
 */
export function generateToken(): string {
  return nanoid(12);
}
