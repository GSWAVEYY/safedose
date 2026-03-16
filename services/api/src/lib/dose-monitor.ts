/**
 * Dose monitor — periodic missed-dose detection + caregiver alert dispatch.
 *
 * USAGE: Call checkMissedDoses() on a schedule (cron job, queue worker, etc.).
 *   - In development: invoke POST /notifications/test or wire a setInterval in index.ts.
 *   - In production: configure a cron trigger (e.g., Vercel Cron, pg_cron, BullMQ)
 *     that calls this function every 5–10 minutes.
 *
 * IDEMPOTENCY: Uses dose_events.notification_sent to prevent duplicate alerts.
 *   A missed dose event is only processed once — the flag is set to true in the
 *   same DB call that triggers the push, preventing race conditions if the cron
 *   fires twice in the same window.
 *
 * WINDOW: Processes missed doses created in the last hour only. Older events
 *   that somehow escaped earlier runs are NOT retroactively alerted — the caregiver
 *   alert would be confusing hours after the fact.
 */

import { prisma } from './db.js';
import { sendMissedDoseAlert } from './push.js';
import { logger } from './logger.js';

// How far back we look for unnotified missed doses (60 minutes)
const LOOKBACK_WINDOW_MS = 60 * 60 * 1000;

// Maximum missed dose events to process in a single check run (safety cap)
const MAX_EVENTS_PER_RUN = 500;

interface CheckResult {
  processed: number;
  alerted: number;
  errors: number;
}

/**
 * Scan for recently missed doses and dispatch caregiver push notifications
 * for any that have not been alerted yet.
 *
 * Safe to call concurrently — the database update is atomic per event.
 * Two simultaneous runs will not double-notify: the first to update
 * notification_sent=true wins; the second's update will affect 0 rows.
 */
export async function checkMissedDoses(): Promise<CheckResult> {
  const windowStart = new Date(Date.now() - LOOKBACK_WINDOW_MS);

  // Fetch unnotified missed dose events within the lookback window.
  // We select only the fields needed — medicationName is PHI but required
  // to dispatch the alert (it goes into the data payload, not the visible text).
  const unnotifiedEvents = await prisma.doseEvent.findMany({
    where: {
      eventType: 'missed',
      notificationSent: false,
      createdAt: { gte: windowStart },
    },
    select: {
      id: true,
      patientId: true,
      medicationName: true,
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_EVENTS_PER_RUN,
  });

  if (unnotifiedEvents.length === 0) {
    return { processed: 0, alerted: 0, errors: 0 };
  }

  let alerted = 0;
  let errors = 0;

  for (const event of unnotifiedEvents) {
    // Atomically mark as sent BEFORE dispatching the push.
    // Rationale: if the push call fails, the caregiver misses one alert —
    // which is preferable to retrying forever and sending duplicate alerts.
    // A failed push is logged; operations can replay if needed.
    const updated = await prisma.doseEvent.updateMany({
      where: {
        id: event.id,
        notificationSent: false, // double-check to prevent races
      },
      data: { notificationSent: true },
    });

    // If another process already claimed this event, skip it
    if (updated.count === 0) {
      continue;
    }

    try {
      await sendMissedDoseAlert(event.patientId, event.medicationName);
      alerted++;
    } catch (err) {
      errors++;
      // Log with event ID for ops visibility — do NOT include medicationName in logs (PHI)
      // PHI RULE: do NOT log medicationName — event ID + patient ID is sufficient for ops
      logger.error(
        { err, eventId: event.id, patientId: event.patientId },
        '[dose-monitor] sendMissedDoseAlert failed'
      );
    }
  }

  logger.info(
    { processed: unnotifiedEvents.length, alerted, errors },
    '[dose-monitor] checkMissedDoses complete'
  );

  return { processed: unnotifiedEvents.length, alerted, errors };
}
