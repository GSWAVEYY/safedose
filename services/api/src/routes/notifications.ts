/**
 * Notification routes — device token registration, preferences, test push.
 *
 * All routes require authentication via JWT.
 *
 * Routes:
 *   POST /notifications/register-token     — upsert Expo push token for caller
 *   GET  /notifications/preferences        — get caller's notification preferences
 *   PUT  /notifications/preferences        — update caller's notification preferences
 *   POST /notifications/test               — send a test push to caller's devices (dev only)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { sendPushNotification } from '../lib/push.js';
import { verifyJwt } from '../middleware/auth.js';
import { Expo } from 'expo-server-sdk';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const registerTokenSchema = z.object({
  token: z
    .string()
    .min(1, 'token is required')
    .refine((t) => Expo.isExpoPushToken(t), {
      message: 'token must be a valid Expo push token',
    }),
  platform: z.enum(['ios', 'android'], {
    errorMap: () => ({ message: 'platform must be ios or android' }),
  }),
});

const notificationPreferencesSchema = z.object({
  missedDose: z.boolean(),
  newMed: z.boolean(),
  interaction: z.boolean(),
  lowRefill: z.boolean(),
});

// ─── Route registration ───────────────────────────────────────────────────────

export async function notificationRoutes(server: FastifyInstance): Promise<void> {

  // ── POST /notifications/register-token ───────────────────────────────────
  // Register or update the caller's Expo push token.
  // Uses upsert on the token value to prevent duplicate rows — the token
  // column has a unique constraint. If the same device re-registers (e.g.,
  // after an app reinstall), the existing record is updated with the current
  // userId and platform, keeping data consistent.

  server.post(
    '/register-token',
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      const result = registerTokenSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', issues: result.error.issues },
        });
      }

      const userId = request.user.id;
      const { token, platform } = result.data;

      // Map 'ios' | 'android' from request body to the Prisma enum value.
      // DevicePlatform also has 'web' but that's not exposed through this endpoint.
      const platformEnum = platform === 'ios' ? ('ios' as const) : ('android' as const);

      await prisma.deviceToken.upsert({
        where: { token },
        create: { userId, token, platform: platformEnum },
        update: { userId, platform: platformEnum },
      });

      return reply.status(201).send({ success: true, platform });
    }
  );

  // ── GET /notifications/preferences ───────────────────────────────────────
  // Return the caller's notification preferences.
  // If no row exists yet, return the defaults (all enabled).

  server.get(
    '/preferences',
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      const userId = request.user.id;

      const prefs = await prisma.notificationPreferences.findUnique({
        where: { userId },
        select: {
          missedDose: true,
          newMed: true,
          interaction: true,
          lowRefill: true,
        },
      });

      // Return defaults if no row found — preferences are opt-out, so all enabled
      const preferences = prefs ?? {
        missedDose: true,
        newMed: true,
        interaction: true,
        lowRefill: true,
      };

      return reply.status(200).send({ success: true, preferences });
    }
  );

  // ── PUT /notifications/preferences ───────────────────────────────────────
  // Update the caller's notification preferences.
  // Uses upsert so the first PUT creates the row.

  server.put(
    '/preferences',
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      const result = notificationPreferencesSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', issues: result.error.issues },
        });
      }

      const userId = request.user.id;
      const { missedDose, newMed, interaction, lowRefill } = result.data;

      const updated = await prisma.notificationPreferences.upsert({
        where: { userId },
        create: { userId, missedDose, newMed, interaction, lowRefill },
        update: { missedDose, newMed, interaction, lowRefill },
        select: {
          missedDose: true,
          newMed: true,
          interaction: true,
          lowRefill: true,
        },
      });

      return reply.status(200).send({ success: true, preferences: updated });
    }
  );

  // ── POST /notifications/test ──────────────────────────────────────────────
  // Send a test push notification to all of the caller's registered devices.
  // Gated to non-production environments to prevent accidental use.

  server.post(
    '/test',
    { preHandler: [verifyJwt] },
    async (request, reply) => {
      if (process.env['NODE_ENV'] === 'production') {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Test notifications are not available in production.',
          },
        });
      }

      const userId = request.user.id;

      const deviceTokens = await prisma.deviceToken.findMany({
        where: { userId },
        select: { token: true },
      });

      if (deviceTokens.length === 0) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NO_DEVICES',
            message: 'No registered devices found. Register a push token first.',
          },
        });
      }

      const tokens = deviceTokens.map((d: typeof deviceTokens[number]) => d.token);

      const sent = await sendPushNotification(
        tokens,
        'SafeDose Test',
        'Push notifications are working correctly.',
        { type: 'test' }
      );

      return reply.status(200).send({
        success: true,
        devicesFound: tokens.length,
        notificationsSent: sent,
      });
    }
  );
}
