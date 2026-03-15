/**
 * Push notification helpers using Expo Server SDK.
 *
 * PLACEHOLDER — Sprint 2 will implement the full push pipeline.
 *
 * Planned:
 * - sendMissedDoseAlert(patientId, caregiverIds, medicationName)
 * - sendRefillReminderAlert(userId, medicationName, refillsRemaining)
 * - sendCaregiverInviteNotification(caregiverId, patientName)
 */

import { Expo } from 'expo-server-sdk';

// Lazily instantiated — avoid startup cost if push not needed
let _expo: Expo | null = null;

function getExpo(): Expo {
  if (!_expo) {
    _expo = new Expo({ accessToken: process.env['EXPO_ACCESS_TOKEN'] });
  }
  return _expo;
}

export { getExpo };

// TODO: implement sendPushNotification(tokens: string[], title: string, body: string, data?: object)
