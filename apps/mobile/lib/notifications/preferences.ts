/**
 * Notification preferences — server-side preference fetching and updating.
 *
 * These preferences control which push notifications the user's caregivers
 * receive. They are stored server-side so all devices stay in sync.
 *
 * Note: These preferences control CAREGIVER push alerts, not the user's own
 * local reminders. Local reminders are always active for the patient.
 */

import { z } from 'zod';
import { apiClient } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export const notificationPreferencesSchema = z.object({
  missedDose: z.boolean(),
  newMed: z.boolean(),
  interaction: z.boolean(),
  lowRefill: z.boolean(),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

interface PreferencesResponse {
  success: boolean;
  preferences: NotificationPreferences;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch the current user's notification preferences from the server.
 * Returns server defaults (all enabled) if no preferences have been set yet.
 *
 * Throws ApiError on network/auth failure — callers should handle gracefully
 * (e.g., show defaults while offline).
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await apiClient<PreferencesResponse>('/notifications/preferences', {
    method: 'GET',
    authenticated: true,
  });

  // Validate the shape coming from the server
  return notificationPreferencesSchema.parse(response.preferences);
}

/**
 * Update the current user's notification preferences on the server.
 * Returns the saved preferences as confirmed by the server.
 *
 * Throws ApiError on failure — callers should display an error and restore
 * the previous toggle state on failure.
 */
export async function updateNotificationPreferences(
  prefs: NotificationPreferences
): Promise<NotificationPreferences> {
  const response = await apiClient<PreferencesResponse>('/notifications/preferences', {
    method: 'PUT',
    body: prefs,
    authenticated: true,
  });

  return notificationPreferencesSchema.parse(response.preferences);
}
