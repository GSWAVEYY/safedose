/**
 * Zustand store for symptom tracking.
 *
 * Wraps the SQLite repository with async actions so screens never call
 * the DB layer directly. State is optimistically updated on log/delete.
 */

import { create } from 'zustand';
import type { Symptom, SymptomInput, SymptomFrequency } from '@safedose/shared-types';

import {
  logSymptom as dbLogSymptom,
  getSymptomHistory as dbGetSymptomHistory,
  getSymptomFrequency as dbGetSymptomFrequency,
  deleteSymptom as dbDeleteSymptom,
} from '../lib/db/symptoms';

// ---------------------------------------------------------------------------
// Placeholder user ID — replaced when auth is wired up in Sprint 2
// ---------------------------------------------------------------------------
const PLACEHOLDER_USER_ID = 'local-user';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface SymptomsState {
  /** Recent symptom logs (loaded by loadSymptomHistory). */
  symptoms: Symptom[];
  /** Frequency map from the last getFrequencyReport call. */
  frequencyReport: SymptomFrequency;
  /** True while an async DB operation is in flight. */
  isLoading: boolean;
  /** Error from the most recent failed operation, or null. */
  error: string | null;

  // ---- Async actions ----

  /**
   * Log a new symptom entry and prepend it to the in-memory list.
   */
  logSymptom: (data: SymptomInput) => Promise<Symptom>;

  /**
   * Load symptom history for the last N days from SQLite.
   * Replaces the in-memory list.
   */
  loadSymptomHistory: (days: number) => Promise<void>;

  /**
   * Fetch a frequency map of symptom tags for the last N days.
   * Stores the result in `frequencyReport`.
   */
  getFrequencyReport: (days: number) => Promise<SymptomFrequency>;

  /**
   * Soft-delete a symptom entry and remove it from the in-memory list.
   */
  removeSymptom: (id: string) => Promise<boolean>;

  // ---- Synchronous helpers ----

  /** Clear any error state. */
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useSymptomsStore = create<SymptomsState>((set, _get) => ({
  symptoms: [],
  frequencyReport: {},
  isLoading: false,
  error: null,

  logSymptom: async (data: SymptomInput) => {
    set({ isLoading: true, error: null });
    try {
      const symptom = await dbLogSymptom(PLACEHOLDER_USER_ID, data);
      set((state) => ({
        // Prepend so newest appears first
        symptoms: [symptom, ...state.symptoms],
        isLoading: false,
      }));
      return symptom;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to log symptom';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  loadSymptomHistory: async (days: number) => {
    set({ isLoading: true, error: null });
    try {
      const symptoms = await dbGetSymptomHistory(PLACEHOLDER_USER_ID, days);
      set({ symptoms, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load symptom history';
      set({ isLoading: false, error: message });
    }
  },

  getFrequencyReport: async (days: number) => {
    try {
      const report = await dbGetSymptomFrequency(PLACEHOLDER_USER_ID, days);
      set({ frequencyReport: report });
      return report;
    } catch (err) {
      console.error('[store] getFrequencyReport failed:', err);
      return {};
    }
  },

  removeSymptom: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const success = await dbDeleteSymptom(id, PLACEHOLDER_USER_ID);
      if (success) {
        set((state) => ({
          symptoms: state.symptoms.filter((s) => s.id !== id),
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
      return success;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete symptom';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
