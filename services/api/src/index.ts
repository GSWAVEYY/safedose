import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth.js';
import { medicationRoutes } from './routes/medications.js';
import { caregivingRoutes } from './routes/caregiving.js';
import { notificationRoutes } from './routes/notifications.js';
import { emergencyRoutes } from './routes/emergency.js';

const server = Fastify({
  logger: {
    level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
  },
});

async function start(): Promise<void> {
  await server.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? true,
  });

  await server.register(fastifyJwt, {
    secret: process.env['JWT_SECRET'] ?? 'dev-secret-change-in-prod',
    sign: { expiresIn: '15m' },
  });

  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Health check
  server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Register route modules
  await server.register(authRoutes, { prefix: '/auth' });
  await server.register(medicationRoutes, { prefix: '/medications' });
  await server.register(caregivingRoutes, { prefix: '/caregiving' });
  await server.register(notificationRoutes, { prefix: '/notifications' });
  await server.register(emergencyRoutes, { prefix: '/emergency' });

  const port = Number(process.env['PORT'] ?? 3001);
  const host = process.env['HOST'] ?? '0.0.0.0';

  await server.listen({ port, host });
  server.log.info(`SafeDose API running on ${host}:${port}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
