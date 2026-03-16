/**
 * Schedule Calculator — pure functions for dose timing.
 *
 * No side effects. No imports from notification or DB layers.
 * All date math operates in the device's local time so that
 * "08:00" means 8 AM for the user, regardless of timezone.
 */

import type { Schedule, FrequencyUnit } from '@safedose/shared-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A resolved dose occurrence for a specific calendar date. */
export interface DoseOccurrence {
  scheduleId: string;
  medicationId: string;
  /** HH:mm string from the schedule (e.g. "08:00") */
  timeSlot: string;
  /** Full Date object for this occurrence */
  scheduledAt: Date;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse an HH:mm string into { hours, minutes }.
 * Throws if the format is invalid — schedule data should already be validated.
 */
function parseTime(hhmm: string): { hours: number; minutes: number } {
  const parts = hhmm.split(':');
  if (parts.length !== 2) {
    throw new Error(`[scheduler] Invalid time format: "${hhmm}"`);
  }
  const hours = parseInt(parts[0] as string, 10);
  const minutes = parseInt(parts[1] as string, 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`[scheduler] Out-of-range time: "${hhmm}"`);
  }
  return { hours, minutes };
}

/**
 * Build a Date from a YYYY-MM-DD string and an HH:mm time string in local time.
 * We explicitly set each component rather than parsing an ISO string to avoid
 * any UTC-midnight-offset issues.
 */
function buildLocalDate(dateStr: string, timeStr: string): Date {
  const dateParts = dateStr.split('-');
  if (dateParts.length !== 3) {
    throw new Error(`[scheduler] Invalid date format: "${dateStr}"`);
  }
  const year = parseInt(dateParts[0] as string, 10);
  const month = parseInt(dateParts[1] as string, 10) - 1; // JS months are 0-indexed
  const day = parseInt(dateParts[2] as string, 10);
  const { hours, minutes } = parseTime(timeStr);
  return new Date(year, month, day, hours, minutes, 0, 0);
}

/**
 * Return today's date as a YYYY-MM-DD string in local time.
 * (new Date().toISOString() would give UTC — wrong for local scheduling.)
 */
function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Determine whether a schedule is active on a given date.
 *
 * A schedule is active on `date` if:
 *   - startDate <= date (in calendar day terms)
 *   - endDate is null OR endDate >= date
 *   - The schedule's frequency cycle falls on this day
 *
 * Frequency logic:
 *   - frequencyUnit = 'days'  → fires every `frequencyValue` days from startDate
 *   - frequencyUnit = 'hours' → fires every `frequencyValue` hours; the times[]
 *     array already stores the pre-calculated HH:mm slots, so we just check all
 *     of them. The "active on this day" check is: startDate <= date.
 *   - frequencyUnit = 'weeks' → fires every `frequencyValue` weeks on the same
 *     weekday as startDate.
 *   - frequencyUnit = 'months' → fires every `frequencyValue` months on the same
 *     day-of-month as startDate.
 */
function isScheduleActiveOnDate(schedule: Schedule, date: Date): boolean {
  const dateStr = localDateString(date);

  // Range check
  if (dateStr < schedule.startDate) return false;
  if (schedule.endDate !== undefined && dateStr > schedule.endDate) return false;

  const { frequencyValue, frequencyUnit, startDate } = schedule;

  // Parse start as a plain date (no time) in local time to avoid DST offset issues.
  const startParts = startDate.split('-');
  const startLocal = new Date(
    parseInt(startParts[0] as string, 10),
    parseInt(startParts[1] as string, 10) - 1,
    parseInt(startParts[2] as string, 10)
  );

  // Normalise the target date to midnight local time for day-level comparison.
  const targetMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  switch (frequencyUnit as FrequencyUnit) {
    case 'hours': {
      // Every N hours — the times[] array holds pre-computed slots for each day.
      // Active every day within the date range.
      return true;
    }

    case 'days': {
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysDiff = Math.round(
        (targetMidnight.getTime() - startLocal.getTime()) / msPerDay
      );
      return daysDiff >= 0 && daysDiff % frequencyValue === 0;
    }

    case 'weeks': {
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysDiff = Math.round(
        (targetMidnight.getTime() - startLocal.getTime()) / msPerDay
      );
      if (daysDiff < 0) return false;
      const weeksDiff = Math.floor(daysDiff / 7);
      const remainder = daysDiff % 7;
      return remainder === 0 && weeksDiff % frequencyValue === 0;
    }

    case 'months': {
      const startDay = startLocal.getDate();
      const targetDay = date.getDate();
      if (startDay !== targetDay) return false;
      const monthsDiff =
        (date.getFullYear() - startLocal.getFullYear()) * 12 +
        (date.getMonth() - startLocal.getMonth());
      return monthsDiff >= 0 && monthsDiff % frequencyValue === 0;
    }

    default: {
      // Exhaustiveness safety — treat unknown units as daily.
      console.warn(`[scheduler] Unknown frequencyUnit: "${frequencyUnit as string}"`);
      return true;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Given a Schedule, return the next upcoming dose time from now (inclusive).
 * Returns null if the schedule has ended or has no future doses within 7 days.
 */
export function getNextDoseTime(schedule: Schedule): Date | null {
  const now = new Date();
  // Walk forward up to 7 days to find the next active day.
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const candidate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + dayOffset
    );
    const candidateStr = localDateString(candidate);

    // End-of-schedule check
    if (schedule.endDate !== undefined && candidateStr > schedule.endDate) {
      return null;
    }

    if (!isScheduleActiveOnDate(schedule, candidate)) {
      continue;
    }

    // Check each time slot on this day
    for (const timeSlot of schedule.times) {
      const doseDate = buildLocalDate(candidateStr, timeSlot);
      if (doseDate >= now) {
        return doseDate;
      }
    }
  }

  return null;
}

/**
 * Given an array of schedules and a target date, return all dose occurrences
 * for that day, sorted chronologically.
 */
export function getDosesForDay(schedules: Schedule[], date: Date): DoseOccurrence[] {
  const dateStr = localDateString(date);
  const occurrences: DoseOccurrence[] = [];

  for (const schedule of schedules) {
    if (!schedule.isActive) continue;
    if (!isScheduleActiveOnDate(schedule, date)) continue;

    for (const timeSlot of schedule.times) {
      occurrences.push({
        scheduleId: schedule.id,
        medicationId: schedule.medicationId,
        timeSlot,
        scheduledAt: buildLocalDate(dateStr, timeSlot),
      });
    }
  }

  // Sort chronologically
  occurrences.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  return occurrences;
}

/**
 * Check whether a schedule has a dose at the given date/time.
 * "At" means: the schedule is active on that day AND the schedule's times[]
 * contains a slot that matches the date's HH:mm.
 */
export function isDoseTime(schedule: Schedule, date: Date): boolean {
  if (!schedule.isActive) return false;
  if (!isScheduleActiveOnDate(schedule, date)) return false;

  const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return schedule.times.includes(hhmm);
}

/**
 * Return a human-readable label for a schedule's frequency.
 *
 * Examples:
 *   frequencyValue=1, unit=days  → "Once daily"
 *   frequencyValue=2, unit=days  → "Every 2 days"
 *   frequencyValue=8, unit=hours → "Every 8 hours"
 *   frequencyValue=1, unit=weeks → "Weekly"
 *   frequencyValue=2, unit=weeks → "Every 2 weeks"
 *   frequencyValue=1, unit=months→ "Monthly"
 */
export function getFrequencyLabel(
  frequencyValue: number,
  frequencyUnit: FrequencyUnit
): string {
  switch (frequencyUnit) {
    case 'hours': {
      if (frequencyValue === 24) return 'Once daily';
      if (frequencyValue === 12) return 'Twice daily';
      if (frequencyValue === 8) return 'Three times daily';
      return `Every ${frequencyValue} hours`;
    }

    case 'days': {
      if (frequencyValue === 1) return 'Once daily';
      if (frequencyValue === 2) return 'Every other day';
      return `Every ${frequencyValue} days`;
    }

    case 'weeks': {
      if (frequencyValue === 1) return 'Weekly';
      return `Every ${frequencyValue} weeks`;
    }

    case 'months': {
      if (frequencyValue === 1) return 'Monthly';
      return `Every ${frequencyValue} months`;
    }

    default: {
      // Exhaustiveness safety
      return `Every ${frequencyValue} ${frequencyUnit as string}`;
    }
  }
}

/**
 * Convenience: given a schedule whose times[] was built from an "N times per day"
 * model, produce a simple label from the times array length.
 *
 * This is a display helper for screens that don't care about the raw frequency
 * but want to show "Twice daily" when there are 2 time slots.
 */
export function getDailyFrequencyLabel(timesCount: number): string {
  switch (timesCount) {
    case 1: return 'Once daily';
    case 2: return 'Twice daily';
    case 3: return 'Three times daily';
    case 4: return 'Four times daily';
    default: return `${timesCount} times daily`;
  }
}
