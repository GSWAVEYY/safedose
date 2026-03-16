import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';

const tokenSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{32}$/, 'Invalid token format'),
});

export async function emergencyRoutes(server: FastifyInstance): Promise<void> {
  // SECURITY: Tight per-IP rate limit — unauthenticated endpoint with PHI
  server.get('/:token', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const result = tokenSchema.safeParse(request.params);
    if (!result.success) {
      // Don't confirm token format expectations — return generic 404
      return reply.status(404).send({ error: 'Not found' });
    }

    const { token } = result.data;

    const card = await prisma.emergencyCardPublic.findUnique({
      where: { qrToken: token },
      select: { data: true, updatedAt: true },
    });

    if (!card) {
      return reply.status(404).send({ error: 'Not found' });
    }

    // Never echo the token back in the response
    return reply.send({
      data: card.data,
      updatedAt: card.updatedAt.toISOString(),
    });
  });
}
