/**
 * Zustand store for appointments.
 *
 * Wraps the SQLite repository with async actions so screens never call
 * the DB layer directly. Upcoming and past lists are kept separate to
 * reflect the two-tab display in the appointments screen.
 */

import { create } from 'zustand';
import type { Appointment, AppointmentCreate, AppointmentUpdate } from '../lib/db/appointments';

import {
  getUpcomingAppointments,
  getPastAppointments,
  createAppointment as dbCreateAppointment,
  updateAppointment as dbUpdateAppointment,
  cancelAppointment as dbCancelAppointment,
  completeAppointment as dbCompleteAppointment,
} from '../lib/db/appointments';
import { useUserStore } from './user';

// ---------------------------------------------------------------------------
// Auth user ID helper — reads from Zustand state outside of React components
// ---------------------------------------------------------------------------
function getUserId(): string {
  return useUserStore.getState().userId ?? 'local-user';
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface AppointmentsState {
  /** Scheduled (upcoming) appointments sorted by date ascending. */
  upcoming: Appointment[];
  /** Completed and cancelled appointments sorted by date descending. */
  past: Appointment[];
  /** True while an async DB operation is in flight. */
  isLoading: boolean;
  /** Error from the most recent failed operation, or null. */
  error: string | null;

  // ---- Async actions ----

  /** Load upcoming appointments from SQLite. */
  loadUpcoming: () => Promise<void>;
  /** Load past appointments from SQLite (most recent N). */
  loadPast: (limit?: number) => Promise<void>;
  /** Create a new appointment. */
  saveAppointment: (data: AppointmentCreate) => Promise<Appointment>;
  /** Update an existing appointment (includes post-visit notes). */
  editAppointment: (id: string, updates: Partial<AppointmentUpdate>) => Promise<Appointment | null>;
  /** Cancel an appointment — moves it from upcoming to past. */
  cancelAppointment: (id: string) => Promise<Appointment | null>;
  /** Mark an appointment as complete with optional post-visit notes. */
  completeAppointment: (id: string, postVisitNotes?: string) => Promise<Appointment | null>;

  // ---- Synchronous helpers ----

  /** Clear error state. */
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useAppointmentsStore = create<AppointmentsState>((set) => ({
  upcoming: [],
  past: [],
  isLoading: false,
  error: null,

  loadUpcoming: async () => {
    set({ isLoading: true, error: null });
    try {
      const upcoming = await getUpcomingAppointments(getUserId());
      set({ upcoming, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load appointments';
      set({ isLoading: false, error: message });
    }
  },

  loadPast: async (limit: number = 50) => {
    set({ isLoading: true, error: null });
    try {
      const past = await getPastAppointments(getUserId(), limit);
      set({ past, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load past appointments';
      set({ isLoading: false, error: message });
    }
  },

  saveAppointment: async (data: AppointmentCreate) => {
    set({ isLoading: true, error: null });
    try {
      const appointment = await dbCreateAppointment(getUserId(), data);
      set((state) => ({
        upcoming: [...state.upcoming, appointment].sort(
          (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        ),
        isLoading: false,
      }));
      return appointment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save appointment';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  editAppointment: async (id: string, updates: Partial<AppointmentUpdate>) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await dbUpdateAppointment(id, getUserId(), updates);
      if (updated) {
        // Update whichever list contains this appointment.
        set((state) => ({
          upcoming: state.upcoming
            .map((a) => (a.id === id ? updated : a))
            .filter((a) => a.status === 'scheduled')
            .sort(
              (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
            ),
          past: state.past
            .map((a) => (a.id === id ? updated : a))
            .filter((a) => a.status !== 'scheduled')
            .sort(
              (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
            ),
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update appointment';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  cancelAppointment: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await dbCancelAppointment(id, getUserId());
      if (updated) {
        // Move from upcoming to past.
        set((state) => ({
          upcoming: state.upcoming.filter((a) => a.id !== id),
          past: [updated, ...state.past],
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel appointment';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  completeAppointment: async (id: string, postVisitNotes?: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await dbCompleteAppointment(id, getUserId(), postVisitNotes);
      if (updated) {
        // Move from upcoming to past.
        set((state) => ({
          upcoming: state.upcoming.filter((a) => a.id !== id),
          past: [updated, ...state.past],
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete appointment';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

// Re-export for convenience so screens that only need upcoming/past can
// derive a combined list without coupling to internal state shape.
export function selectAllAppointments(state: AppointmentsState): Appointment[] {
  return [...state.upcoming, ...state.past];
}
