/**
 * SafeDose mobile subscription service.
 *
 * Handles:
 * - Fetching subscription status from the API
 * - Initiating Stripe Checkout via expo-web-browser
 * - Opening the Stripe Customer Portal
 * - Feature availability checks
 *
 * Stripe Checkout flow (mobile):
 *   1. POST /subscriptions/checkout → receive checkoutUrl
 *   2. Open checkoutUrl in expo-web-browser (in-app browser)
 *   3. On success, Stripe redirects to successUrl (deep link: safedose://subscription/success)
 *   4. App receives the deep link, closes browser, refreshes subscription status
 */

import * as WebBrowser from 'expo-web-browser';
import { apiClient, ApiError } from '../api/client';
import { isFeatureAvailable, type FeatureKey, type SubscriptionTier } from './features';

export { ApiError, isFeatureAvailable };
export type { FeatureKey, SubscriptionTier };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  status: string | null;
  stripeSubscriptionId: string | null;
}

interface CheckoutResponse {
  success: boolean;
  checkoutUrl: string;
}

interface PortalResponse {
  success: boolean;
  portalUrl: string;
}

interface StatusResponse {
  success: boolean;
  tier: SubscriptionTier;
  status: string | null;
  stripeSubscriptionId: string | null;
}

export type BillingInterval = 'month' | 'year';

// ─── Deep link URLs ───────────────────────────────────────────────────────────

// These must match the deep link scheme configured in app.json
const CHECKOUT_SUCCESS_URL = 'safedose://subscription/success';
const CHECKOUT_CANCEL_URL = 'safedose://subscription/cancel';

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's current subscription status.
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const data = await apiClient<StatusResponse>('/subscriptions/status', {
    authenticated: true,
  });
  return {
    tier: data.tier,
    status: data.status,
    stripeSubscriptionId: data.stripeSubscriptionId,
  };
}

/**
 * Initiate Stripe Checkout for a new subscription.
 *
 * Opens the Stripe-hosted checkout page in an in-app browser.
 * Returns the WebBrowser result — callers should check `result.type === 'opened'`
 * and then poll subscription status after the browser closes.
 */
export async function startCheckout(
  tier: Exclude<SubscriptionTier, 'free'>,
  interval: BillingInterval
): Promise<WebBrowser.WebBrowserResult> {
  const data = await apiClient<CheckoutResponse>('/subscriptions/checkout', {
    method: 'POST',
    authenticated: true,
    body: {
      tier,
      interval,
      successUrl: CHECKOUT_SUCCESS_URL,
      cancelUrl: CHECKOUT_CANCEL_URL,
    },
  });

  return WebBrowser.openBrowserAsync(data.checkoutUrl, {
    // Show browser chrome so users can see they're on stripe.com
    enableBarCollapsing: false,
    showTitle: true,
  });
}

/**
 * Open the Stripe Customer Portal for managing an existing subscription.
 * Allows users to cancel, change plan, or update payment method.
 */
export async function openCustomerPortal(): Promise<WebBrowser.WebBrowserResult> {
  const data = await apiClient<PortalResponse>('/subscriptions/portal', {
    method: 'POST',
    authenticated: true,
  });

  return WebBrowser.openBrowserAsync(data.portalUrl, {
    enableBarCollapsing: false,
    showTitle: true,
  });
}

/**
 * Check if the given feature is available for a subscription tier.
 * Delegates to the feature gate definitions.
 */
export function checkFeatureAvailable(feature: FeatureKey, tier: SubscriptionTier): boolean {
  return isFeatureAvailable(feature, tier);
}
