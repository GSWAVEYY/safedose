/**
 * Zustand store for caregiver wellness tracking.
 *
 * Wraps the SQLite wellness repository so screens never touch the DB layer
 * directly. All data stays on device — no server sync for mental health data.
 */

import { create } from 'zustand';
import type {
  WellnessCheckin,
  WellnessCheckinInput,
  BurnoutRiskResult,
} from '../lib/db/wellness';
import {
  logCheckin as dbLogCheckin,
  getRecentCheckins as dbGetRecentCheckins,
  getBurnoutRiskScore as dbGetBurnoutRiskScore,
  getLastCheckinDate as dbGetLastCheckinDate,
} from '../lib/db/wellness';
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

interface WellnessState {
  /** The most recent computed burnout risk result, or null before first load. */
  burnoutRisk: BurnoutRiskResult | null;
  /** Recent check-ins loaded from the last loadRecentCheckins call. */
  recentCheckins: WellnessCheckin[];
  /** Unix ms timestamp of the last check-in, or null if never checked in. */
  lastCheckinAt: number | null;
  /** True while a DB operation is in flight. */
  isLoading: boolean;
  /** Error from the most recent failed operation, or null. */
  error: string | null;

  // ---- Actions ----

  /**
   * Submit a new wellness check-in. Persists to SQLite and refreshes the
   * burnout score and lastCheckinAt in memory immediately.
   */
  logCheckin: (data: WellnessCheckinInput) => Promise<WellnessCheckin>;

  /**
   * Load the burnout risk score from SQLite based on recent check-ins.
   * Also refreshes lastCheckinAt.
   */
  loadBurnoutScore: () => Promise<void>;

  /**
   * Load the last N weeks of check-ins into memory.
   * Defaults to 8 weeks for the wellness history view.
   */
  loadRecentCheckins: (weeks?: number) => Promise<void>;

  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useWellnessStore = create<WellnessState>((set) => ({
  burnoutRisk: null,
  recentCheckins: [],
  lastCheckinAt: null,
  isLoading: false,
  error: null,

  logCheckin: async (data: WellnessCheckinInput) => {
    set({ isLoading: true, error: null });
    try {
      const checkin = await dbLogCheckin(getUserId(), data);
      // Refresh burnout score and last check-in date after write
      const [risk, lastDate] = await Promise.all([
        dbGetBurnoutRiskScore(getUserId()),
        dbGetLastCheckinDate(getUserId()),
      ]);
      set((state) => ({
        recentCheckins: [checkin, ...state.recentCheckins],
        burnoutRisk: risk,
        lastCheckinAt: lastDate,
        isLoading: false,
      }));
      return checkin;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save check-in';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  loadBurnoutScore: async () => {
    set({ isLoading: true, error: null });
    try {
      const [risk, lastDate] = await Promise.all([
        dbGetBurnoutRiskScore(getUserId()),
        dbGetLastCheckinDate(getUserId()),
      ]);
      set({ burnoutRisk: risk, lastCheckinAt: lastDate, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load wellness data';
      set({ isLoading: false, error: message });
    }
  },

  loadRecentCheckins: async (weeks = 8) => {
    set({ isLoading: true, error: null });
    try {
      const checkins = await dbGetRecentCheckins(getUserId(), weeks);
      set({ recentCheckins: checkins, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load check-in history';
      set({ isLoading: false, error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
