/**
 * User profile routes.
 *
 * Routes:
 *   GET /users/me — return the authenticated caller's profile
 *
 * Used by the mobile app's checkAuth flow to hydrate the current user after
 * token verification. Returns only fields safe to expose to the owner —
 * no password hash, no Stripe IDs.
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';
import { verifyJwt } from '../middleware/auth.js';

// ─── Route registration ───────────────────────────────────────────────────────

export async function userRoutes(server: FastifyInstance): Promise<void> {

  // ── GET /users/me ─────────────────────────────────────────────────────────
  // Return the authenticated user's profile.
  // Sensitive fields (passwordHash, stripeCustomerId, stripeSubscriptionId)
  // are explicitly excluded from the select — never sent to the client.

  server.get('/me', { preHandler: [verifyJwt] }, async (request, reply) => {
    const userId = request.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        locale: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        emergencyQrToken: true,
        createdAt: true,
        lastSeen: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found.',
        },
      });
    }

    // Update lastSeen on profile fetch — keeps the field current without
    // requiring a dedicated heartbeat endpoint.
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeen: new Date() },
    });

    return reply.status(200).send({
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email ?? null,
        phone: user.phone ?? null,
        locale: user.locale,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus ?? null,
        emergencyQrToken: user.emergencyQrToken,
        createdAt: user.createdAt.toISOString(),
        lastSeen: user.lastSeen.toISOString(),
      },
    });
  });
}
