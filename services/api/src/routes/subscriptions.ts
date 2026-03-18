/**
 * Subscription routes for SafeDose API.
 *
 * POST /subscriptions/checkout  — create Stripe Checkout session (auth required)
 * POST /subscriptions/portal    — create Customer Portal session (auth required)
 * GET  /subscriptions/status    — get current subscription state (auth required)
 * POST /subscriptions/webhook   — Stripe webhook handler (NO auth — Stripe signature)
 *
 * Webhook security: Stripe-Signature header is verified using the raw request body.
 * We must add the `rawBody` content-type parser to Fastify for the webhook route
 * before this plugin is registered.
 *
 * Why raw body matters: Stripe's signature is computed over the exact bytes sent.
 * If Fastify parses JSON first and re-serializes it, the bytes change and the
 * signature check fails.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type Stripe from 'stripe';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { verifyJwt } from '../middleware/auth.js';
import {
  getOrCreateCustomer,
  createCheckoutSession,
  createCustomerPortalSession,
  constructWebhookEvent,
  getPriceId,
  tierFromPriceId,
} from '../lib/stripe.js';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const checkoutBodySchema = z.object({
  tier: z.enum(['premium', 'family']),
  interval: z.enum(['month', 'year']),
  successUrl: z.string().url('successUrl must be a valid URL'),
  cancelUrl: z.string().url('cancelUrl must be a valid URL'),
});

// ─── Route registration ───────────────────────────────────────────────────────

export async function subscriptionRoutes(server: FastifyInstance): Promise<void> {

  // ── POST /subscriptions/checkout ─────────────────────────────────────────

  server.post(
    '/checkout',
    { preHandler: [verifyJwt] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = checkoutBodySchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', issues: result.error.issues },
        });
      }

      const { tier, interval, successUrl, cancelUrl } = result.data;
      const userId = request.user.id;
      const userEmail = request.user.email ?? null;

      let customerId: string;
      try {
        customerId = await getOrCreateCustomer(userId, userEmail);
      } catch (err: unknown) {
        server.log.error({ userId, err: err instanceof Error ? err.message : String(err) }, 'Failed to get or create Stripe customer');
        return reply.status(500).send({
          success: false,
          error: { code: 'STRIPE_ERROR', message: 'Failed to initialize billing. Please try again.' },
        });
      }

      let priceId: string;
      try {
        priceId = getPriceId(tier, interval);
      } catch (err: unknown) {
        server.log.error({ tier, interval, err: err instanceof Error ? err.message : String(err) }, 'Missing price ID env var');
        return reply.status(500).send({
          success: false,
          error: { code: 'CONFIG_ERROR', message: 'Billing is not configured. Please contact support.' },
        });
      }

      let checkoutUrl: string;
      try {
        checkoutUrl = await createCheckoutSession({
          customerId,
          priceId,
          successUrl,
          cancelUrl,
          userId,
        });
      } catch (err: unknown) {
        server.log.error({ userId, tier, interval, err: err instanceof Error ? err.message : String(err) }, 'Failed to create Stripe Checkout session');
        return reply.status(500).send({
          success: false,
          error: { code: 'STRIPE_ERROR', message: 'Failed to create checkout session. Please try again.' },
        });
      }

      return reply.status(200).send({ success: true, checkoutUrl });
    }
  );

  // ── POST /subscriptions/portal ────────────────────────────────────────────

  server.post(
    '/portal',
    { preHandler: [verifyJwt] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (!user?.stripeCustomerId) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'NO_SUBSCRIPTION',
            message: 'No active subscription found. Please subscribe first.',
          },
        });
      }

      // Default return URL — mobile deep link or web fallback
      const returnUrl = process.env['SUBSCRIPTION_PORTAL_RETURN_URL'] ?? 'safedose://subscription';

      let portalUrl: string;
      try {
        portalUrl = await createCustomerPortalSession(user.stripeCustomerId, returnUrl);
      } catch (err: unknown) {
        server.log.error({ userId, err: err instanceof Error ? err.message : String(err) }, 'Failed to create Stripe portal session');
        return reply.status(500).send({
          success: false,
          error: { code: 'STRIPE_ERROR', message: 'Failed to open billing portal. Please try again.' },
        });
      }

      return reply.status(200).send({ success: true, portalUrl });
    }
  );

  // ── GET /subscriptions/status ─────────────────────────────────────────────

  server.get(
    '/status',
    { preHandler: [verifyJwt] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          subscriptionTier: true,
          subscriptionStatus: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
        });
      }

      return reply.status(200).send({
        success: true,
        tier: user.subscriptionTier,
        status: user.subscriptionStatus,
      });
    }
  );

  // ── POST /subscriptions/webhook ───────────────────────────────────────────

  server.post(
    '/webhook',
    {
      config: {
        // Exclude from global rate limit — Stripe retries are legitimate
        rateLimit: { max: 500, timeWindow: '1 minute' },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        return reply.status(400).send({ error: 'Missing Stripe-Signature header' });
      }

      // rawBody is attached by the content-type parser registered in index.ts
      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
      if (!rawBody) {
        server.log.error('Webhook received without rawBody — check content-type parser');
        return reply.status(400).send({ error: 'Raw body unavailable' });
      }

      let event: Stripe.Event;
      try {
        event = constructWebhookEvent(rawBody, signature);
      } catch (err: unknown) {
        server.log.warn({ err: err instanceof Error ? err.message : String(err) }, 'Stripe webhook signature verification failed');
        return reply.status(400).send({ error: 'Invalid signature' });
      }

      // Log only the event type and ID — never the full event object
      server.log.info({ eventType: event.type, eventId: event.id }, 'Processing Stripe webhook');

      try {
        await handleWebhookEvent(event, server);
      } catch (err: unknown) {
        server.log.error({ eventType: event.type, eventId: event.id, err: err instanceof Error ? err.message : String(err) }, 'Webhook handler error');
        // Return 200 to prevent Stripe from retrying on our application errors.
        // We log the error for investigation. Only return non-200 for Stripe's
        // own errors (bad signature above) so Stripe knows to retry.
      }

      return reply.status(200).send({ received: true });
    }
  );
}

// ─── Webhook event handlers ───────────────────────────────────────────────────

async function handleWebhookEvent(
  event: Stripe.Event,
  server: FastifyInstance
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, server);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, server);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, server);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice, server);
      break;
    default:
      // Unhandled event types are expected — Stripe sends many event types.
      // Silently ignore rather than log noise.
      break;
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  server: FastifyInstance
): Promise<void> {
  const userId = session.metadata?.['safedose_user_id'];
  if (!userId) {
    server.log.warn({ sessionId: session.id }, 'checkout.session.completed missing safedose_user_id metadata');
    return;
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;

  if (!subscriptionId) {
    server.log.warn({ sessionId: session.id, userId }, 'checkout.session.completed has no subscription ID');
    return;
  }

  // Retrieve full subscription to get the price ID and determine tier
  const { stripe: stripeLib } = await import('../lib/stripe.js');
  const subscription = await stripeLib().subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceId ? (tierFromPriceId(priceId) ?? 'free') : 'free';

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: tier,
      subscriptionStatus: subscription.status,
      stripeSubscriptionId: subscriptionId,
    },
  });

  server.log.info({ userId, subscriptionId, tier, status: subscription.status }, 'Subscription activated after checkout');
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  server: FastifyInstance
): Promise<void> {
  const userId = subscription.metadata?.['safedose_user_id'];
  if (!userId) {
    server.log.warn({ subscriptionId: subscription.id }, 'customer.subscription.updated missing safedose_user_id metadata');
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceId ? (tierFromPriceId(priceId) ?? 'free') : 'free';

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: tier,
      subscriptionStatus: subscription.status,
      stripeSubscriptionId: subscription.id,
    },
  });

  server.log.info({ userId, subscriptionId: subscription.id, tier, status: subscription.status }, 'Subscription updated');
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  server: FastifyInstance
): Promise<void> {
  const userId = subscription.metadata?.['safedose_user_id'];
  if (!userId) {
    server.log.warn({ subscriptionId: subscription.id }, 'customer.subscription.deleted missing safedose_user_id metadata');
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: 'free',
      subscriptionStatus: 'canceled',
      stripeSubscriptionId: null,
    },
  });

  server.log.info({ userId, subscriptionId: subscription.id }, 'Subscription canceled — tier reset to free');
}

async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  server: FastifyInstance
): Promise<void> {
  const sub = (invoice as unknown as Record<string, unknown>)['subscription'];
  const subscriptionId = typeof sub === 'string'
    ? sub
    : (sub as { id?: string } | null)?.id;

  if (!subscriptionId) return;

  // Find the user by stripeSubscriptionId — metadata not on invoice
  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    select: { id: true },
  });

  if (!user) {
    server.log.warn({ subscriptionId }, 'invoice.payment_failed — no user found for subscription');
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: 'past_due' },
  });

  server.log.warn({ userId: user.id, subscriptionId }, 'Payment failed — subscription marked past_due');
}
