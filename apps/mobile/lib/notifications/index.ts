/**
 * Notification Manager — wraps expo-notifications for SafeDose local alerts.
 *
 * PHI POLICY: Notification content must NEVER include medication names, doses,
 * diagnoses, or any other Protected Health Information. Notifications contain
 * only generic text ("Time for your medication"). The detailed information is
 * shown when the user opens the app. This protects against lock-screen snooping
 * and lock-screen screenshots.
 *
 * This module manages local notifications only. Push notifications (Sprint 2)
 * will be handled separately via a caregiver alert service.
 */

import * as ExpoNotifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import type { Schedule, Medication } from '@safedose/shared-types';

import { getNextDoseTime } from './scheduler';

// ---------------------------------------------------------------------------
// Notification handler configuration
// ---------------------------------------------------------------------------

/**
 * Configure how notifications behave while the app is in the foreground.
 * We show a banner with sound so the user sees the reminder even while using
 * another part of the app.
 */
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ---------------------------------------------------------------------------
// Identifier namespacing
// ---------------------------------------------------------------------------

/**
 * Primary reminder: one identifier per schedule ID.
 * This makes it simple to cancel/replace a schedule's notification.
 */
function reminderIdentifier(scheduleId: string): string {
  return `safedose-reminder-${scheduleId}`;
}

/**
 * Missed-dose follow-up: keyed by schedule + ISO date string so a new one
 * can be scheduled each day without colliding.
 */
function followupIdentifier(medicationId: string, scheduledAtIso: string): string {
  // Strip characters that could cause issues in notification identifiers
  const safeDate = scheduledAtIso.replace(/[:.]/g, '-');
  return `safedose-followup-${medicationId}-${safeDate}`;
}

// ---------------------------------------------------------------------------
// Permission & initialisation
// ---------------------------------------------------------------------------

/**
 * Request notification permissions and configure the notification channel
 * (Android). Should be called once at app start, after the database is ready.
 *
 * Returns true if permissions were granted, false otherwise.
 */
export async function initNotifications(): Promise<boolean> {
  // Set up Android notification channel — required for Android 8+.
  // On iOS this is a no-op.
  await ExpoNotifications.setNotificationChannelAsync('dose-reminders', {
    name: 'Dose Reminders',
    importance: ExpoNotifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#14B8A6', // brand-500 teal
  });

  await ExpoNotifications.setNotificationChannelAsync('missed-dose-alerts', {
    name: 'Missed Dose Alerts',
    importance: ExpoNotifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#D97706', // amber-600 — warning, not red (design system rule)
  });

  const { status: existingStatus } = await ExpoNotifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await ExpoNotifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return status === 'granted';
}

// ---------------------------------------------------------------------------
// Schedule a reminder
// ---------------------------------------------------------------------------

/**
 * Schedule a local notification for the next upcoming dose of a medication.
 *
 * PHI RULE: The notification body does NOT include the medication name, dose,
 * or any health information. Only a generic prompt is shown on the lock screen.
 *
 * The medication object is accepted as a parameter but only used to determine
 * whether the medication has a `withFood` instruction (to show a generic
 * "with food" note). Even this is debatable — kept only because "take with
 * food" is not itself PHI (it's a generic instruction).
 *
 * Returns the notification identifier, or null if no upcoming dose was found
 * or permissions are not granted.
 */
export async function scheduleReminder(
  medication: Pick<Medication, 'id'>,
  schedule: Schedule
): Promise<string | null> {
  const nextDoseTime = getNextDoseTime(schedule);
  if (nextDoseTime === null) {
    return null;
  }

  // Cancel any existing reminder for this schedule before rescheduling.
  await cancelReminder(schedule.id);

  const identifier = reminderIdentifier(schedule.id);
  const triggerDate = nextDoseTime;

  const body = schedule.withFood
    ? 'Time for your medication. Take with food.'
    : 'Time for your medication.';

  try {
    await ExpoNotifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: 'Medication Reminder',
        body,
        sound: 'default',
        // categoryIdentifier enables actionable notifications (iOS)
        // where the user can tap "Done" or "Snooze" from the lock screen.
        // The category must be registered separately (Sprint 2 enhancement).
        data: {
          // Only non-PHI data — the app uses this to navigate to schedule screen.
          type: 'dose-reminder',
          scheduleId: schedule.id,
          medicationId: medication.id,
        },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    return identifier;
  } catch (error) {
    console.error('[notifications] scheduleReminder failed:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Missed-dose follow-up
// ---------------------------------------------------------------------------

/**
 * Schedule a second notification 30 minutes after the original scheduled time
 * for a dose that has not yet been confirmed.
 *
 * This is fired when the primary reminder fires — the app checks if the dose
 * was confirmed; if not, it calls this function to remind again.
 *
 * PHI RULE: Same as scheduleReminder — generic text only.
 *
 * @param medicationId - Used only for identifier namespacing (non-PHI)
 * @param scheduledAt - ISO 8601 string of the original dose time
 */
export async function scheduleMissedDoseFollowup(
  medicationId: string,
  scheduledAt: string
): Promise<string | null> {
  const originalTime = new Date(scheduledAt);
  const followupTime = new Date(originalTime.getTime() + 30 * 60 * 1000); // +30 min

  // Do not schedule a follow-up in the past.
  if (followupTime <= new Date()) {
    return null;
  }

  const identifier = followupIdentifier(medicationId, scheduledAt);

  try {
    await ExpoNotifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: 'Did you take your medication?',
        body: 'You have an unconfirmed dose. Tap to confirm or skip.',
        sound: 'default',
        data: {
          type: 'missed-dose-followup',
          medicationId,
          scheduledAt,
        },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: followupTime,
      },
    });

    return identifier;
  } catch (error) {
    console.error('[notifications] scheduleMissedDoseFollowup failed:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

/**
 * Cancel the scheduled reminder for a single schedule.
 */
export async function cancelReminder(scheduleId: string): Promise<void> {
  try {
    await ExpoNotifications.cancelScheduledNotificationAsync(
      reminderIdentifier(scheduleId)
    );
  } catch (error) {
    // Not finding the notification is not an error — it may already have fired.
    console.warn('[notifications] cancelReminder: notification not found or already fired');
  }
}

/**
 * Cancel all scheduled notifications for a medication.
 * Fetches the full scheduled list and cancels any that belong to this med.
 */
export async function cancelAllRemindersForMedication(
  medicationId: string
): Promise<void> {
  try {
    const scheduled = await ExpoNotifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled.filter((n) => {
      const data = n.content.data as Record<string, unknown> | null;
      return data?.medicationId === medicationId;
    });

    await Promise.all(
      toCancel.map((n) =>
        ExpoNotifications.cancelScheduledNotificationAsync(n.identifier)
      )
    );
  } catch (error) {
    console.error('[notifications] cancelAllRemindersForMedication failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Reschedule all (called on app resume)
// ---------------------------------------------------------------------------

/**
 * Rebuild all scheduled notifications from the provided active schedules.
 *
 * Strategy:
 * 1. Cancel all existing SafeDose notifications (to remove stale ones).
 * 2. Schedule fresh reminders for every active schedule.
 *
 * This is safe to call on every app foreground event because:
 * - We only touch notifications namespaced to "safedose-*".
 * - The operation is idempotent — rescheduling the same time overwrites the
 *   previous entry via the identifier.
 *
 * @param medications - Map of medicationId → Medication (for withFood flag)
 * @param schedules   - All active schedules to reschedule
 */
export async function rescheduleAllReminders(
  medications: Map<string, Pick<Medication, 'id'>>,
  schedules: Schedule[]
): Promise<void> {
  // Cancel all existing SafeDose-namespaced notifications.
  try {
    const existing = await ExpoNotifications.getAllScheduledNotificationsAsync();
    const safedoseNotifs = existing.filter((n) =>
      n.identifier.startsWith('safedose-')
    );
    await Promise.all(
      safedoseNotifs.map((n) =>
        ExpoNotifications.cancelScheduledNotificationAsync(n.identifier)
      )
    );
  } catch (error) {
    console.error('[notifications] rescheduleAllReminders: cancel phase failed:', error);
    // Continue anyway — better to have duplicate notifications than none.
  }

  // Schedule fresh reminders for all active schedules.
  for (const schedule of schedules) {
    if (!schedule.isActive) continue;

    const medication = medications.get(schedule.medicationId);
    if (medication === undefined) {
      console.warn(
        `[notifications] rescheduleAllReminders: no medication found for scheduleId=${schedule.id}`
      );
      continue;
    }

    await scheduleReminder(medication, schedule);
  }
}
