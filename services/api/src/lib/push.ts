/**
 * Push notification service — Expo Server SDK.
 *
 * PHI POLICY: Notification title and body MUST NOT contain drug names, doses,
 * diagnoses, or any other Protected Health Information. PHI is only placed in
 * the `data` payload, which is never displayed in the notification center or
 * on the lock screen. The app reads it after the user opens the notification.
 *
 * Alert types:
 *   - Missed dose   → caregivers with receiveMissedDoseAlerts permission
 *   - New medication → caregivers with viewMedications permission
 *   - Interaction   → caregivers with receiveMissedDoseAlerts permission
 *     (reused — broadest "something needs attention" permission)
 */

import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from './db.js';
import { logger } from './logger.js';

// ─── Expo client (lazy singleton) ─────────────────────────────────────────────

let _expo: Expo | null = null;

function getExpo(): Expo {
  if (!_expo) {
    _expo = new Expo({
      accessToken: process.env['EXPO_ACCESS_TOKEN'],
      useFcmV1: true, // FCM HTTP v1 API (required from June 2024)
    });
  }
  return _expo;
}

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Non-PHI data payload carried by every caregiver push notification.
 * The app uses these fields to navigate and display details after open.
 */
interface CaregiverAlertData {
  type: 'missed_dose' | 'new_med' | 'interaction';
  patientId: string;
  /** PHI — only in data payload, never in visible notification text */
  medicationName?: string;
}

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Send a push notification to one or more Expo push tokens.
 *
 * Handles:
 *  - expo-server-sdk chunking (max 100 messages per HTTP call)
 *  - Invalid/expired token cleanup (removes them from the database)
 *  - DeviceNotRegistered and InvalidCredentials errors per Expo docs
 *
 * Returns the count of successfully enqueued messages.
 */
export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<number> {
  const expo = getExpo();

  // Filter to valid Expo push tokens only — skip malformed tokens
  const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));

  if (validTokens.length === 0) {
    return 0;
  }

  const messages: ExpoPushMessage[] = validTokens.map((to) => ({
    to,
    title,
    body,
    data,
    sound: 'default',
    priority: 'high',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const invalidTokens: string[] = [];
  let successCount = 0;

  for (const chunk of chunks) {
    let tickets: ExpoPushTicket[];
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      // Network / server error — log and skip this chunk, don't crash the caller
      logger.error({ err }, '[push] sendPushNotification: chunk send failed');
      continue;
    }

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket === undefined) continue;

      if (ticket.status === 'ok') {
        successCount++;
      } else if (ticket.status === 'error') {
        logger.error(
          {
            token: chunk[i]?.to ?? 'unknown',
            errorCode: ticket.details?.error ?? 'unknown',
            message: ticket.message,
          },
          '[push] ticket error'
        );

        // Remove stale / invalid tokens immediately so they don't accumulate
        if (
          ticket.details?.error === 'DeviceNotRegistered' ||
          ticket.details?.error === 'InvalidCredentials'
        ) {
          const badToken = chunk[i]?.to;
          if (typeof badToken === 'string') {
            invalidTokens.push(badToken);
          }
        }
      }
    }
  }

  // Clean up invalid tokens in a single batch
  if (invalidTokens.length > 0) {
    await deleteInvalidTokens(invalidTokens);
  }

  return successCount;
}

// ─── Caregiver resolution helpers ────────────────────────────────────────────

/**
 * Fetch all accepted caregiver relationships for a patient where the caregiver
 * has the specified permission flag set to true in the JSON permissions object.
 *
 * Returns an array of caregiver user IDs.
 */
async function getCaregiverIdsWithPermission(
  patientId: string,
  permissionKey: string
): Promise<string[]> {
  const relationships = await prisma.caregiverRelationship.findMany({
    where: {
      patientId,
      status: 'accepted',
      caregiverId: { not: null },
    },
    select: {
      caregiverId: true,
      permissions: true,
    },
  });

  return relationships
    .filter((r: typeof relationships[number]) => {
      const perms =
        typeof r.permissions === 'object' && r.permissions !== null && !Array.isArray(r.permissions)
          ? (r.permissions as Record<string, unknown>)
          : {};
      return perms[permissionKey] === true;
    })
    .map((r: typeof relationships[number]) => r.caregiverId as string);
}

/**
 * Fetch all Expo push tokens for the given user IDs.
 */
async function getPushTokensForUsers(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];

  const tokens = await prisma.deviceToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true },
  });

  return tokens.map((t: typeof tokens[number]) => t.token);
}

// ─── Domain-specific alert functions ─────────────────────────────────────────

/**
 * Notify all eligible caregivers that a patient missed a scheduled dose.
 *
 * PHI RULE: medicationName goes into the data payload ONLY.
 *           The visible title and body contain no drug name or health info.
 */
export async function sendMissedDoseAlert(
  patientId: string,
  medicationName: string
): Promise<void> {
  const caregiverIds = await getCaregiverIdsWithPermission(
    patientId,
    'receiveMissedDoseAlerts'
  );

  if (caregiverIds.length === 0) return;

  const tokens = await getPushTokensForUsers(caregiverIds);
  if (tokens.length === 0) return;

  const data: CaregiverAlertData = {
    type: 'missed_dose',
    patientId,
    medicationName, // PHI — only in data, never in title/body
  };

  await sendPushNotification(
    tokens,
    'SafeDose Alert',
    'A medication dose was missed.',
    { ...data }
  );
}

/**
 * Notify caregivers when the patient adds a new medication.
 * Uses viewMedications permission as the gate.
 */
export async function sendNewMedAlert(patientId: string): Promise<void> {
  const caregiverIds = await getCaregiverIdsWithPermission(
    patientId,
    'viewMedications'
  );

  if (caregiverIds.length === 0) return;

  const tokens = await getPushTokensForUsers(caregiverIds);
  if (tokens.length === 0) return;

  const data: Omit<CaregiverAlertData, 'medicationName'> = {
    type: 'new_med',
    patientId,
  };

  await sendPushNotification(
    tokens,
    'SafeDose',
    'Your patient added a new medication.',
    { ...data }
  );
}

/**
 * Notify caregivers when a drug interaction is detected for the patient.
 * Uses receiveMissedDoseAlerts as the broadest "safety attention" permission.
 */
export async function sendInteractionAlert(patientId: string): Promise<void> {
  const caregiverIds = await getCaregiverIdsWithPermission(
    patientId,
    'receiveMissedDoseAlerts'
  );

  if (caregiverIds.length === 0) return;

  const tokens = await getPushTokensForUsers(caregiverIds);
  if (tokens.length === 0) return;

  const data: Omit<CaregiverAlertData, 'medicationName'> = {
    type: 'interaction',
    patientId,
  };

  await sendPushNotification(
    tokens,
    'SafeDose Alert',
    'A potential medication interaction was detected.',
    data
  );
}

// ─── Token cleanup ────────────────────────────────────────────────────────────

/**
 * Remove tokens that Expo has flagged as no longer registered.
 * Called automatically after each send batch — callers do not need to invoke this.
 */
async function deleteInvalidTokens(tokens: string[]): Promise<void> {
  try {
    await prisma.deviceToken.deleteMany({
      where: { token: { in: tokens } },
    });
    logger.info({ count: tokens.length }, '[push] removed invalid device token(s)');
  } catch (err) {
    // Non-fatal — stale tokens will just bounce silently on the next send
    logger.error({ err }, '[push] deleteInvalidTokens failed');
  }
}
