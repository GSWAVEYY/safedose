/**
 * Zustand store for the doctor directory.
 *
 * Wraps the SQLite repository with async actions so screens never call
 * the DB layer directly. Mutations optimistically update the in-memory list
 * and roll back on error.
 */

import { create } from 'zustand';
import type { Doctor, DoctorCreate, DoctorUpdate } from '../lib/db/doctors';

import {
  getAllDoctors,
  getDoctorById,
  createDoctor as dbCreateDoctor,
  updateDoctor as dbUpdateDoctor,
  deleteDoctor as dbDeleteDoctor,
} from '../lib/db/doctors';

// ---------------------------------------------------------------------------
// Placeholder user ID — replaced when auth is implemented in Sprint 2
// ---------------------------------------------------------------------------
const PLACEHOLDER_USER_ID = 'local-user';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface DoctorsState {
  /** All non-deleted doctors for the current user, sorted by name. */
  doctors: Doctor[];
  /** True while an async DB operation is in flight. */
  isLoading: boolean;
  /** Error from the most recent failed operation, or null. */
  error: string | null;

  // ---- Async actions ----

  /** Load all doctors from SQLite into the store. */
  loadDoctors: () => Promise<void>;
  /** Refresh a single doctor from SQLite (used after external edits). */
  refreshDoctor: (id: string) => Promise<void>;
  /** Create a new doctor and add it to the store. */
  saveDoctor: (data: DoctorCreate) => Promise<Doctor>;
  /** Update an existing doctor. */
  editDoctor: (id: string, updates: Partial<DoctorUpdate>) => Promise<Doctor | null>;
  /** Soft-delete a doctor. */
  removeDoctor: (id: string) => Promise<boolean>;

  // ---- Synchronous helpers ----

  /** Direct setter for loading state. */
  setLoading: (loading: boolean) => void;
  /** Clear error state. */
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useDoctorsStore = create<DoctorsState>((set, _get) => ({
  doctors: [],
  isLoading: false,
  error: null,

  loadDoctors: async () => {
    set({ isLoading: true, error: null });
    try {
      const doctors = await getAllDoctors(PLACEHOLDER_USER_ID);
      set({ doctors, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load doctors';
      set({ isLoading: false, error: message });
    }
  },

  refreshDoctor: async (id: string) => {
    try {
      const doctor = await getDoctorById(id, PLACEHOLDER_USER_ID);
      if (doctor) {
        set((state) => ({
          doctors: state.doctors.map((d) => (d.id === id ? doctor : d)),
        }));
      }
    } catch (err) {
      console.error('[store/doctors] refreshDoctor failed:', err);
    }
  },

  saveDoctor: async (data: DoctorCreate) => {
    set({ isLoading: true, error: null });
    try {
      const doctor = await dbCreateDoctor(PLACEHOLDER_USER_ID, data);
      set((state) => ({
        doctors: [...state.doctors, doctor].sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      }));
      return doctor;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save doctor';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  editDoctor: async (id: string, updates: Partial<DoctorUpdate>) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await dbUpdateDoctor(id, PLACEHOLDER_USER_ID, updates);
      if (updated) {
        set((state) => ({
          doctors: state.doctors
            .map((d) => (d.id === id ? updated : d))
            .sort((a, b) => a.name.localeCompare(b.name)),
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update doctor';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  removeDoctor: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const success = await dbDeleteDoctor(id, PLACEHOLDER_USER_ID);
      if (success) {
        set((state) => ({
          doctors: state.doctors.filter((d) => d.id !== id),
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
      return success;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete doctor';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),
  clearError: () => set({ error: null }),
}));
