/**
 * Sentry error monitoring — React Native / Expo initialisation.
 *
 * PHI POLICY: Sentry events MUST NOT contain any Protected Health Information.
 * Medication names, diagnoses, dosing instructions, caregiver relationships —
 * none of it may reach Sentry. We enforce this by:
 *   1. beforeSend hook: scrub known PHI fields from every event.
 *   2. User context: only opaque userId — never name, email, or health data.
 *   3. Breadcrumbs: strip any data payloads that could contain med info.
 *
 * The DSN is read from app.config.ts extra.EXPO_PUBLIC_SENTRY_DSN.
 * Call initMobileSentry() once, before any navigation is mounted.
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// PHI scrubbing
// ---------------------------------------------------------------------------

/**
 * Field keys that are never allowed in Sentry events.
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
  'refillDate',
  'pillCount',
]);

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
 * Initialise Sentry for the React Native app.
 * Safe to call when DSN is not set — Sentry no-ops gracefully.
 */
export function initMobileSentry(): void {
  // DSN is injected via app.config.ts extra → accessible at runtime via
  // Constants.expoConfig.extra.EXPO_PUBLIC_SENTRY_DSN
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const dsn = typeof extra?.['EXPO_PUBLIC_SENTRY_DSN'] === 'string'
    ? extra['EXPO_PUBLIC_SENTRY_DSN']
    : undefined;

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const releaseChannel =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.['releaseChannel'] as
      | string
      | undefined;

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    release: `safedose@${version}`,
    dist: releaseChannel ?? 'default',

    // Capture all transactions in dev; sample in production.
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,

    // Scrub PHI before every event.
    beforeSend(event) {
      if (event.extra != null) {
        event.extra = scrubPhi(event.extra as Record<string, unknown>);
      }
      return event;
    },

    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = scrubPhi(breadcrumb.data as Record<string, unknown>);
      }
      return breadcrumb;
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set user context for subsequent events.
 * Only userId (opaque string) — never name, email, or health data.
 */
export function setSentryUser(userId: string): void {
  Sentry.setUser({ id: userId });
}

/** Clear user context on logout. */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Capture a non-fatal error (e.g. SQLite failure that was handled gracefully).
 * Context must not contain PHI.
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

// Re-export the wrap helper so app entry can wrap the root component.
export const wrap = Sentry.wrap;
