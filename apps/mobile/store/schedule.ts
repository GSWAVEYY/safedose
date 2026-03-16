/**
 * Schedule Zustand store — today's doses with real-time status tracking.
 *
 * The store merges two data sources:
 *   1. getTodaysDoses()    — the scheduled occurrences (what should happen)
 *   2. getTodaysDoseLog()  — the confirmed events    (what did happen)
 *
 * Status logic:
 *   - A DoseItem's status is derived at load time and can be updated
 *     optimistically by confirmDose() before the DB write completes.
 *   - "missed" is computed at load time for any past doses with no log entry.
 *   - "due" means the scheduled time is within ±15 minutes of now.
 */

import { create } from 'zustand';
import type { DoseEventType } from '@safedose/shared-types';

import { getTodaysDoses } from '../lib/db/schedules';
import { getTodaysDoseLog, logDose } from '../lib/db/dose-log';
import { getDosesForDay } from '../lib/notifications/scheduler';
import type { DoseLog } from '@safedose/shared-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DoseStatus = 'upcoming' | 'due' | 'taken' | 'late' | 'missed' | 'skipped';

export interface DoseItem {
  /** Unique composite key: scheduleId + timeSlot */
  id: string;
  scheduleId: string;
  medicationId: string;
  medicationName: string;
  /** HH:mm string */
  timeSlot: string;
  scheduledAt: Date;
  status: DoseStatus;
  /** Present once the dose has been confirmed */
  logEntry?: DoseLog;
  withFood: boolean;
  notes?: string;
  /** Strength display string e.g. "10 mg" */
  strengthLabel: string;
}

interface ScheduleState {
  todaysDoses: DoseItem[];
  isLoading: boolean;
  error: string | null;
  lastLoadedAt: Date | null;
  loadTodaysDoses: (userId: string) => Promise<void>;
  confirmDose: (
    doseId: string,
    status: Extract<DoseEventType, 'taken' | 'skipped' | 'late'>,
    options?: ConfirmDoseOptions
  ) => Promise<void>;
  refreshSchedule: (userId: string) => Promise<void>;
}

export interface ConfirmDoseOptions {
  /** Override confirmed time (for "Taken Earlier" flow) */
  confirmedAt?: string;
  confirmedBy?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Status resolution helpers
// ---------------------------------------------------------------------------

/** Window in milliseconds during which a dose is considered "due now". */
const DUE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Compute the display status for a dose item based on its scheduled time
 * and any existing log entry.
 */
function resolveDoseStatus(scheduledAt: Date, logEntry?: DoseLog): DoseStatus {
  if (logEntry !== undefined) {
    switch (logEntry.eventType) {
      case 'taken':
      case 'caregiver_confirmed':
        return 'taken';
      case 'late':
        return 'late';
      case 'skipped':
        return 'skipped';
      case 'missed':
        return 'missed';
      default:
        return 'taken';
    }
  }

  const now = new Date();
  const msDiff = scheduledAt.getTime() - now.getTime();

  if (msDiff < -DUE_WINDOW_MS) {
    // Past the due window and no log entry → missed
    return 'missed';
  }

  if (Math.abs(msDiff) <= DUE_WINDOW_MS) {
    // Within ±15 minutes → due now
    return 'due';
  }

  // Future dose
  return 'upcoming';
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  todaysDoses: [],
  isLoading: false,
  error: null,
  lastLoadedAt: null,

  loadTodaysDoses: async (userId: string) => {
    set({ isLoading: true, error: null });

    try {
      const [todayDoseRows, doseLogs] = await Promise.all([
        getTodaysDoses(userId),
        getTodaysDoseLog(userId),
      ]);

      // Build a lookup map: ISO scheduledAt string → DoseLog
      // We key by medicationId + HH:mm to match occurrences without needing
      // exact millisecond equality.
      const logMap = new Map<string, DoseLog>();
      for (const log of doseLogs) {
        const scheduledDate = new Date(log.scheduledAt);
        const hh = String(scheduledDate.getHours()).padStart(2, '0');
        const mm = String(scheduledDate.getMinutes()).padStart(2, '0');
        const key = `${log.medicationId}:${hh}:${mm}`;
        logMap.set(key, log);
      }

      const today = new Date();
      const doseItems: DoseItem[] = [];

      for (const todayDose of todayDoseRows) {
        // Use the scheduler to get the exact occurrences for today,
        // respecting the frequency logic (every N days, weekly, etc.).
        const occurrences = getDosesForDay([todayDose.schedule], today);

        for (const occ of occurrences) {
          const hh = String(occ.scheduledAt.getHours()).padStart(2, '0');
          const mm = String(occ.scheduledAt.getMinutes()).padStart(2, '0');
          const logKey = `${todayDose.schedule.medicationId}:${hh}:${mm}`;
          const logEntry = logMap.get(logKey);

          const status = resolveDoseStatus(occ.scheduledAt, logEntry);

          const itemId = `${occ.scheduleId}:${occ.timeSlot}`;

          doseItems.push({
            id: itemId,
            scheduleId: occ.scheduleId,
            medicationId: occ.medicationId,
            medicationName: todayDose.medicationName,
            timeSlot: occ.timeSlot,
            scheduledAt: occ.scheduledAt,
            status,
            logEntry,
            withFood: todayDose.schedule.withFood,
            notes: todayDose.schedule.notes,
            // strengthLabel is not available from the schedules join alone.
            // The medication detail (dosageAmount + dosageUnit) would require
            // a separate query or join extension. We store a placeholder here;
            // the screen can hydrate from useMedicationsStore if needed.
            strengthLabel: '',
          });
        }
      }

      // Sort chronologically
      doseItems.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

      set({ todaysDoses: doseItems, isLoading: false, lastLoadedAt: new Date() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load schedule';
      console.error('[schedule-store] loadTodaysDoses failed:', error);
      set({ isLoading: false, error: message });
    }
  },

  confirmDose: async (doseId, eventType, options = {}) => {
    const { todaysDoses } = get();
    const doseItem = todaysDoses.find((d) => d.id === doseId);

    if (doseItem === undefined) {
      console.warn(`[schedule-store] confirmDose: doseId "${doseId}" not found`);
      return;
    }

    // Optimistic update — the UI reflects the new status immediately.
    const optimisticStatus: DoseStatus =
      eventType === 'taken' ? 'taken'
      : eventType === 'late' ? 'late'
      : 'skipped';

    set((state) => ({
      todaysDoses: state.todaysDoses.map((d) =>
        d.id === doseId ? { ...d, status: optimisticStatus } : d
      ),
    }));

    try {
      const confirmedAt = options.confirmedAt ?? new Date().toISOString();

      const logEntry = await logDose({
        patientId: doseItem.medicationId, // patientId comes from auth in Sprint 2;
        // for now we use medicationId as a placeholder — this field will be
        // wired to the real userId once Auth (Sprint 2) lands.
        medicationId: doseItem.medicationId,
        medicationName: doseItem.medicationName,
        eventType,
        scheduledAt: doseItem.scheduledAt.toISOString(),
        confirmedAt,
        confirmedBy: options.confirmedBy,
        notes: options.notes,
      });

      // Persist the log entry in the store item.
      set((state) => ({
        todaysDoses: state.todaysDoses.map((d) =>
          d.id === doseId ? { ...d, logEntry } : d
        ),
      }));
    } catch (error) {
      console.error('[schedule-store] confirmDose: DB write failed:', error);

      // Revert optimistic update on failure.
      const originalStatus = resolveDoseStatus(doseItem.scheduledAt, doseItem.logEntry);
      set((state) => ({
        todaysDoses: state.todaysDoses.map((d) =>
          d.id === doseId ? { ...d, status: originalStatus } : d
        ),
      }));

      throw error;
    }
  },

  refreshSchedule: async (userId: string) => {
    // Full reload — same as loadTodaysDoses, exposed separately so callers
    // can distinguish between initial load and a pull-to-refresh.
    await get().loadTodaysDoses(userId);
  },
}));
