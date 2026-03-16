/**
 * Push token registration — Expo push token lifecycle management.
 *
 * Registers the device's Expo push token with the SafeDose API so the server
 * can send caregiver alerts. Call registerPushToken() after a successful login
 * or registration; call unregisterPushToken() on logout.
 *
 * This module handles both iOS and Android. On Android, a notification channel
 * is created by the local notification manager (lib/notifications/index.ts) —
 * the push token registration here is a separate concern.
 */

import * as ExpoNotifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegisterTokenResponse {
  success: boolean;
  platform: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the device's Expo push token and register it with the SafeDose API.
 *
 * Prerequisites:
 *  - The user must be authenticated (the API call uses the stored access token).
 *  - Notification permissions must be granted before calling this.
 *    Call initNotifications() from lib/notifications/index.ts first.
 *
 * Returns true if the token was successfully registered, false otherwise.
 * Errors are logged but not thrown — push notification failure is not fatal.
 */
export async function registerPushToken(): Promise<boolean> {
  try {
    // Expo Go uses a separate token format — skip in Expo Go simulator
    const projectId =
      Constants.expoConfig?.extra?.['eas']?.['projectId'] as string | undefined;

    if (!projectId) {
      console.warn(
        '[push] registerPushToken: no EAS project ID found in app config — skipping token registration'
      );
      return false;
    }

    const tokenData = await ExpoNotifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

    await apiClient<RegisterTokenResponse>('/notifications/register-token', {
      method: 'POST',
      body: { token, platform },
      authenticated: true,
    });

    return true;
  } catch (err) {
    // Non-fatal — app works without push; caregiver will just not get remote alerts
    console.error('[push] registerPushToken failed:', err);
    return false;
  }
}

/**
 * Remove the current device's push token from the API on logout.
 *
 * This prevents the server from sending push notifications to a device
 * after the user has signed out. Safe to call even if no token is registered.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const projectId =
      Constants.expoConfig?.extra?.['eas']?.['projectId'] as string | undefined;

    if (!projectId) {
      return;
    }

    const tokenData = await ExpoNotifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    await apiClient<{ success: boolean }>('/notifications/unregister-token', {
      method: 'DELETE',
      body: { token },
      authenticated: true,
    });
  } catch (err) {
    // Non-fatal — token will be cleaned up on next failed send attempt
    console.warn('[push] unregisterPushToken failed (non-fatal):', err);
  }
}
