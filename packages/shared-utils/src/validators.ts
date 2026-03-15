/**
 * Basic validators shared between mobile and API.
 * For full schema validation, use zod in the consuming package.
 */

/**
 * Returns true if the string is a valid E.164 phone number.
 * e.g. +12125551234
 */
export function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * Returns true if the string is a valid email address.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Returns true if value is a non-empty string after trimming.
 */
export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Returns true if the string is a valid ISO 8601 date/datetime.
 */
export function isValidIso(value: string): boolean {
  return !isNaN(Date.parse(value));
}
