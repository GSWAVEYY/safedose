/**
 * SafeDose subscription Zustand store.
 *
 * Manages subscription state in memory, sourced from the API.
 * Use `loadSubscription()` on app start (after auth) to hydrate.
 *
 * Pattern mirrors the user store: optimistic local state with
 * API as the source of truth.
 */

import { create } from 'zustand';
import {
  getSubscriptionStatus,
  startCheckout,
  openCustomerPortal,
  ApiError,
  type SubscriptionTier,
  type BillingInterval,
} from '../lib/subscriptions/index';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionState {
  // State
  tier: SubscriptionTier;
  status: string | null;
  stripeSubscriptionId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSubscription: () => Promise<void>;
  startCheckout: (tier: Exclude<SubscriptionTier, 'free'>, interval: BillingInterval) => Promise<void>;
  openPortal: () => Promise<void>;
  clearError: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  tier: 'free',
  status: null,
  stripeSubscriptionId: null,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  /**
   * Fetch subscription status from the API and hydrate the store.
   * Call this after successful authentication or when returning to the
   * subscription screen to ensure the displayed tier is current.
   */
  loadSubscription: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getSubscriptionStatus();
      set({
        tier: data.tier,
        status: data.status,
        stripeSubscriptionId: data.stripeSubscriptionId,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to load subscription status. Please try again.';
      set({ isLoading: false, error: message });
    }
  },

  /**
   * Open Stripe Checkout for a new subscription.
   * After the browser closes (success or cancel), the caller should call
   * `loadSubscription()` to refresh the tier from the API — webhook may
   * have already updated it.
   */
  startCheckout: async (tier, interval) => {
    set({ isLoading: true, error: null });
    try {
      await startCheckout(tier, interval);
      // Browser opened — tier update arrives via webhook → loadSubscription
      set({ isLoading: false });
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to start checkout. Please try again.';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  /**
   * Open the Stripe Customer Portal.
   * After the browser closes, call `loadSubscription()` to pick up any
   * plan changes the user made in the portal.
   */
  openPortal: async () => {
    set({ isLoading: true, error: null });
    try {
      await openCustomerPortal();
      set({ isLoading: false });
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to open billing portal. Please try again.';
      set({ isLoading: false, error: message });
      throw err;
    }
  },
}));
