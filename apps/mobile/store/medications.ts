/**
 * Zustand store for medications.
 *
 * Wraps the SQLite repository with async actions so screens never call
 * the DB layer directly. All mutations optimistically update the in-memory
 * list and roll back on error.
 */

import { create } from 'zustand';
import type { Medication, MedicationCreate, MedicationUpdate } from '@safedose/shared-types';
import type { InteractionCheckResult } from '../lib/interactions/types';

import {
  getAllMedications,
  getMedicationById,
  createMedication as dbCreateMedication,
  updateMedication as dbUpdateMedication,
  deleteMedication as dbDeleteMedication,
  searchMedications as dbSearchMedications,
} from '../lib/db/medications';

// ---------------------------------------------------------------------------
// Placeholder user ID — replaced when auth is implemented in Sprint 2
// ---------------------------------------------------------------------------
const PLACEHOLDER_USER_ID = 'local-user';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface MedicationsState {
  /** Full list of non-deleted medications for the current user. */
  medications: Medication[];
  /** True while an async DB operation is in flight. */
  isLoading: boolean;
  /** Error from the most recent failed operation, or null. */
  error: string | null;
  /** Cached interaction check results keyed by medication ID. */
  interactionResults: Record<string, InteractionCheckResult>;

  // ---- Async DB actions ----

  /** Load all medications from SQLite into the store. */
  loadMedications: () => Promise<void>;
  /** Create a new medication and add it to the store. */
  saveMedication: (data: MedicationCreate) => Promise<Medication>;
  /** Update an existing medication. */
  editMedication: (id: string, updates: Partial<MedicationUpdate>) => Promise<Medication | null>;
  /** Soft-delete a medication. */
  removeMedication: (id: string) => Promise<boolean>;
  /** Pause a medication (isActive = false, endedAt stays null). */
  pauseMedication: (id: string) => Promise<Medication | null>;
  /** Resume a paused medication (isActive = true). */
  resumeMedication: (id: string) => Promise<Medication | null>;
  /** Discontinue a medication (set endedAt = now). */
  discontinueMedication: (id: string) => Promise<Medication | null>;
  /** Search medications by name in SQLite and update store. */
  searchMedications: (query: string) => Promise<Medication[]>;
  /** Reload a single medication from SQLite (used after edits). */
  refreshMedication: (id: string) => Promise<void>;
  /** Store an interaction check result for a medication. */
  setInteractionResult: (medicationId: string, result: InteractionCheckResult) => void;

  // ---- Synchronous helpers ----

  /** Direct setter for bulk replacement (e.g. after pull-to-refresh). */
  setMedications: (medications: Medication[]) => void;
  /** Direct setter for loading state. */
  setLoading: (loading: boolean) => void;
  /** Clear error state. */
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useMedicationsStore = create<MedicationsState>((set, get) => ({
  medications: [],
  isLoading: false,
  error: null,
  interactionResults: {},

  // ---- Async actions ----

  loadMedications: async () => {
    set({ isLoading: true, error: null });
    try {
      const medications = await getAllMedications(PLACEHOLDER_USER_ID);
      set({ medications, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load medications';
      set({ isLoading: false, error: message });
    }
  },

  saveMedication: async (data: MedicationCreate) => {
    set({ isLoading: true, error: null });
    try {
      const medication = await dbCreateMedication(PLACEHOLDER_USER_ID, data);
      set((state) => ({
        medications: [...state.medications, medication].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
        isLoading: false,
      }));
      return medication;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save medication';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  editMedication: async (id: string, updates: Partial<MedicationUpdate>) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await dbUpdateMedication(id, PLACEHOLDER_USER_ID, updates);
      if (updated) {
        set((state) => ({
          medications: state.medications
            .map((m) => (m.id === id ? updated : m))
            .sort((a, b) => a.name.localeCompare(b.name)),
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update medication';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  removeMedication: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const success = await dbDeleteMedication(id, PLACEHOLDER_USER_ID);
      if (success) {
        set((state) => ({
          medications: state.medications.filter((m) => m.id !== id),
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
      return success;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete medication';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  pauseMedication: async (id: string) => {
    return get().editMedication(id, { isActive: false });
  },

  resumeMedication: async (id: string) => {
    return get().editMedication(id, { isActive: true, endedAt: undefined });
  },

  discontinueMedication: async (id: string) => {
    return get().editMedication(id, {
      isActive: false,
      endedAt: new Date().toISOString(),
    });
  },

  searchMedications: async (query: string) => {
    try {
      return await dbSearchMedications(PLACEHOLDER_USER_ID, query);
    } catch (err) {
      console.error('[store] searchMedications failed:', err);
      return [];
    }
  },

  refreshMedication: async (id: string) => {
    try {
      const medication = await getMedicationById(id, PLACEHOLDER_USER_ID);
      if (medication) {
        set((state) => ({
          medications: state.medications.map((m) => (m.id === id ? medication : m)),
        }));
      }
    } catch (err) {
      console.error('[store] refreshMedication failed:', err);
    }
  },

  setInteractionResult: (medicationId: string, result: InteractionCheckResult) => {
    set((state) => ({
      interactionResults: {
        ...state.interactionResults,
        [medicationId]: result,
      },
    }));
  },

  // ---- Synchronous helpers ----

  setMedications: (medications: Medication[]) => set({ medications }),
  setLoading: (isLoading: boolean) => set({ isLoading }),
  clearError: () => set({ error: null }),
}));
