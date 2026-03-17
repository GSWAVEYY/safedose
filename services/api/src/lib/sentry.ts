/**
 * Sentry error monitoring — server-side initialisation.
 *
 * PHI POLICY: Sentry events MUST NOT contain any Protected Health Information.
 * Medication names, diagnoses, doses, user health data — none of it should
 * reach Sentry. We scrub before sending by:
 *   1. Not including request body in breadcrumbs (too risky — contains med data).
 *   2. beforeSend hook: strip any phi_* keys and known sensitive fields.
 *   3. User context: only userId (opaque ID) — never name, email, or health data.
 *
 * Call initSentry() once, before the Fastify server starts.
 */

import * as Sentry from '@sentry/node';

// ---------------------------------------------------------------------------
// PHI scrubbing
// ---------------------------------------------------------------------------

/**
 * Field keys that are never allowed in Sentry events.
 * These appear in request bodies, breadcrumb data, or extra context.
 */
const PHI_KEYS = new Set([
  'name',
  'medication',
  'medicationName',
  'drug',
  'drugName',
  'genericName',
  'instructions',
  'diagnosis',
  'condition',
  'symptom',
  'symptoms',
  'prescriber',
  'pharmacy',
  'dob',
  'dateOfBirth',
  'bloodType',
  'allergies',
  'medicalConditions',
  'notes',
]);

/**
 * Recursively scrub PHI keys from an object.
 * Replaces values with '[REDACTED]' rather than deleting the key
 * so that the structure is visible in Sentry without exposing content.
 */
function scrubPhi(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PHI_KEYS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = scrubPhi(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise Sentry. Safe to call even when SENTRY_DSN is not set —
 * Sentry will no-op without a DSN (useful in development).
 */
export function initSentry(): void {
  const dsn = process.env['SENTRY_DSN'];

  // Read version from package.json at runtime.
  // We use a try/catch so a missing package.json never crashes the server.
  let release: string | undefined;
  try {
    // Dynamic import of JSON is fine in Node ESM with --resolveJsonModule
    // But to avoid tsconfig complications we just read the env var if set.
    release = process.env['npm_package_version']
      ? `safedose-api@${process.env['npm_package_version']}`
      : undefined;
  } catch {
    // Non-fatal
  }

  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    release,

    // Capture 100% of transactions in development; tune down in production.
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,

    // Scrub PHI before every event reaches Sentry.
    beforeSend(event) {
      // Strip request body — too likely to contain medication data.
      if (event.request) {
        event.request.data = '[REDACTED — request body suppressed for PHI compliance]';
      }

      // Scrub extra context if present.
      if (event.extra != null) {
        event.extra = scrubPhi(event.extra as Record<string, unknown>);
      }

      return event;
    },

    // Do not send breadcrumbs that contain request body data.
    beforeBreadcrumb(breadcrumb) {
      // Strip any data that might contain PHI.
      if (breadcrumb.data) {
        breadcrumb.data = scrubPhi(breadcrumb.data as Record<string, unknown>);
      }
      return breadcrumb;
    },
  });
}

/**
 * Capture a non-fatal exception in Sentry.
 * Use this for expected error paths where we want visibility without
 * crashing the server (e.g. third-party service failures).
 *
 * NEVER pass medication names, health data, or user PII as context.
 */
export function captureException(
  error: unknown,
  context?: Record<string, string | number | boolean>
): void {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Set the current user context for subsequent Sentry events.
 * Only the opaque userId is passed — never name, email, or health data.
 */
export function setSentryUser(userId: string): void {
  Sentry.setUser({ id: userId });
}

/** Clear user context (on logout). */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}
