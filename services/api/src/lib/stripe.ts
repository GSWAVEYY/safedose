/**
 * SafeDose Stripe service.
 *
 * Wraps the Stripe SDK with application-specific helpers:
 *   - createCustomer       — provision a Stripe customer, persist id to User
 *   - createCheckoutSession — hosted Checkout for new subscriptions
 *   - createCustomerPortalSession — self-serve subscription management
 *   - getSubscriptionStatus — current subscription state from Stripe
 *
 * Price IDs are read from environment variables so they can differ between
 * test and production without code changes.
 *
 * NEVER log full Stripe objects — they may contain PII or card metadata.
 * Log only the fields the application needs for debugging.
 */

import Stripe from 'stripe';
import { prisma } from './db.js';

// ─── Client ───────────────────────────────────────────────────────────────────

function getStripeClient(): Stripe {
  const secretKey = process.env['STRIPE_SECRET_KEY'];
  if (!secretKey) {
    throw new Error('FATAL: STRIPE_SECRET_KEY environment variable is not set');
  }
  return new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover',
    typescript: true,
  });
}

// Lazy singleton — avoids constructing Stripe before env vars are loaded
let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!_stripe) {
    _stripe = getStripeClient();
  }
  return _stripe;
}

// ─── Price ID helpers ─────────────────────────────────────────────────────────

export type SubscriptionTier = 'premium' | 'family';
export type BillingInterval = 'month' | 'year';

export function getPriceId(tier: SubscriptionTier, interval: BillingInterval): string {
  const envMap: Record<SubscriptionTier, Record<BillingInterval, string>> = {
    premium: {
      month: 'STRIPE_PREMIUM_MONTHLY_PRICE_ID',
      year: 'STRIPE_PREMIUM_ANNUAL_PRICE_ID',
    },
    family: {
      month: 'STRIPE_FAMILY_MONTHLY_PRICE_ID',
      year: 'STRIPE_FAMILY_ANNUAL_PRICE_ID',
    },
  };

  const envVar = envMap[tier][interval];
  const priceId = process.env[envVar];
  if (!priceId) {
    throw new Error(`Missing environment variable: ${envVar}`);
  }
  return priceId;
}

// ─── Customer management ──────────────────────────────────────────────────────

/**
 * Retrieve or create a Stripe customer for the given user.
 * If the user already has a stripeCustomerId we return it immediately
 * without making a redundant Stripe API call.
 */
export async function getOrCreateCustomer(userId: string, email: string | null): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe().customers.create({
    metadata: { safedose_user_id: userId },
    ...(email ? { email } : {}),
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

export interface CheckoutSessionParams {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: string;
}

/**
 * Create a Stripe Checkout session for a new subscription.
 * Returns the hosted checkout URL to redirect the user to.
 */
export async function createCheckoutSession(
  params: CheckoutSessionParams
): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    customer: params.customerId,
    payment_method_types: ['card'],
    line_items: [{ price: params.priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { safedose_user_id: params.userId },
    subscription_data: {
      metadata: { safedose_user_id: params.userId },
    },
  });

  if (!session.url) {
    throw new Error('Stripe Checkout session did not return a URL');
  }
  return session.url;
}

// ─── Customer Portal ──────────────────────────────────────────────────────────

/**
 * Create a Stripe Customer Portal session for managing an existing subscription.
 * Returns the portal URL.
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

// ─── Subscription status ──────────────────────────────────────────────────────

export interface SubscriptionInfo {
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

/**
 * Fetch current subscription state from Stripe.
 * Use this for authoritative status checks — webhook events update the DB,
 * but this is the fallback for direct queries.
 */
export async function getSubscriptionStatus(
  subscriptionId: string
): Promise<SubscriptionInfo> {
  const subscription = await stripe().subscriptions.retrieve(subscriptionId);
  // Stripe SDK v20+ moved current_period_end to items; use items.data[0] or fallback
  const item = subscription.items?.data?.[0];
  const periodEnd = (item as unknown as Record<string, unknown> | undefined)?.['current_period_end'];
  return {
    status: subscription.status,
    currentPeriodEnd: typeof periodEnd === 'number' ? new Date(periodEnd * 1000) : new Date(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

// ─── Webhook signature verification ──────────────────────────────────────────

/**
 * Verify Stripe webhook signature and parse the event.
 * Throws if the signature is invalid — callers should return 400.
 */
export function constructWebhookEvent(
  rawBody: Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
  if (!webhookSecret) {
    throw new Error('FATAL: STRIPE_WEBHOOK_SECRET environment variable is not set');
  }
  return stripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
}

// ─── Tier resolution ──────────────────────────────────────────────────────────

/**
 * Map a Stripe price ID back to a SafeDose subscription tier.
 * Used during webhook processing to determine which tier to grant.
 */
export function tierFromPriceId(priceId: string): SubscriptionTier | null {
  const premiumIds = [
    process.env['STRIPE_PREMIUM_MONTHLY_PRICE_ID'],
    process.env['STRIPE_PREMIUM_ANNUAL_PRICE_ID'],
  ].filter(Boolean);

  const familyIds = [
    process.env['STRIPE_FAMILY_MONTHLY_PRICE_ID'],
    process.env['STRIPE_FAMILY_ANNUAL_PRICE_ID'],
  ].filter(Boolean);

  if (premiumIds.includes(priceId)) return 'premium';
  if (familyIds.includes(priceId)) return 'family';
  return null;
}
