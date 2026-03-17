import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import type { FastifyRequest } from 'fastify';
import { initSentry, captureException } from './lib/sentry.js';
import { authRoutes } from './routes/auth.js';
import { medicationRoutes } from './routes/medications.js';
import { caregivingRoutes } from './routes/caregiving.js';
import { notificationRoutes } from './routes/notifications.js';
import { emergencyRoutes } from './routes/emergency.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import { userRoutes } from './routes/users.js';

// Initialise Sentry as early as possible — before any async work — so that
// errors during startup are captured. Safe when SENTRY_DSN is not set.
initSentry();

// Capture uncaught exceptions and unhandled rejections that escape Fastify's
// error handler. Sentry receives these before process.exit is called.
process.on('uncaughtException', (err) => {
  captureException(err, { source: 'uncaughtException' });
  console.error('[fatal] uncaughtException:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  captureException(reason, { source: 'unhandledRejection' });
  console.error('[fatal] unhandledRejection:', reason);
  process.exit(1);
});

const server = Fastify({
  logger: {
    level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
  },
});

async function start(): Promise<void> {
  // SECURITY: Explicit CORS origin required in production — no wildcard fallback
  const corsOrigin = process.env['CORS_ORIGIN'];
  if (!corsOrigin && process.env['NODE_ENV'] === 'production') {
    throw new Error('FATAL: CORS_ORIGIN environment variable must be set in production');
  }
  await server.register(cors, {
    origin: corsOrigin ?? false,
  });

  // SECURITY: JWT secret must be set — no weak fallback
  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret && process.env['NODE_ENV'] === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production');
  }
  await server.register(fastifyJwt, {
    secret: jwtSecret ?? 'dev-only-secret-not-for-production',
    sign: { expiresIn: '15m' },
  });

  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Health check
  server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Raw body parser for Stripe webhook signature verification.
  // Stripe's signature is computed over the exact bytes of the request body.
  // We intercept application/json on the webhook path only, storing the raw
  // Buffer on the request object before forwarding to the standard JSON parser.
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req: FastifyRequest, body: Buffer, done: (err: Error | null, payload?: unknown) => void) => {
      // Attach rawBody for Stripe webhook routes
      (req as FastifyRequest & { rawBody?: Buffer }).rawBody = body;
      try {
        done(null, JSON.parse(body.toString('utf8')));
      } catch (err: unknown) {
        const parseErr = err instanceof Error ? err : new Error(String(err));
        parseErr.message = `Invalid JSON: ${parseErr.message}`;
        done(parseErr);
      }
    }
  );

  // Register route modules
  await server.register(authRoutes, { prefix: '/auth' });
  await server.register(medicationRoutes, { prefix: '/medications' });
  await server.register(caregivingRoutes, { prefix: '/caregiving' });
  await server.register(notificationRoutes, { prefix: '/notifications' });
  await server.register(emergencyRoutes, { prefix: '/emergency' });
  await server.register(subscriptionRoutes, { prefix: '/subscriptions' });
  await server.register(userRoutes, { prefix: '/users' });

  const port = Number(process.env['PORT'] ?? 3001);
  const host = process.env['HOST'] ?? '0.0.0.0';

  await server.listen({ port, host });
  server.log.info(`SafeDose API running on ${host}:${port}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
