/**
 * haptics — thin wrapper over expo-haptics.
 *
 * Centralises all haptic calls so every interaction uses a consistent,
 * named feedback type rather than inline Haptics.impactAsync() calls.
 * Import { haptics } and call haptics.light(), haptics.success(), etc.
 *
 * All functions return void. Haptic APIs are best-effort on devices that
 * do not support haptics (older Android, simulator) — no error propagation.
 */

import * as Haptics from 'expo-haptics';

export const haptics = {
  /** Subtle tap — navigation, selection, keyboard press */
  light: (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /** Standard button press, drawer open/close */
  medium: (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  /** Destructive action confirmation, heavy toggle */
  heavy: (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /** Dose confirmed, form submitted successfully */
  success: (): void => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  /** Non-critical alert, validation warning */
  warning: (): void => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },

  /** Action failed, destructive confirmation */
  error: (): void => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
};
