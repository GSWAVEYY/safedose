import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const registerTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});

export async function notificationRoutes(server: FastifyInstance): Promise<void> {
  server.post('/register-token', async (request, reply) => {
    const body = registerTokenSchema.parse(request.body);
    // TODO: Save device push token
    return reply.status(201).send({ message: 'Token registered', platform: body.platform });
  });

  server.get('/preferences', async (_request, reply) => {
    // TODO: Return user notification preferences
    return reply.send({ preferences: { missedDose: true, newMed: true, interaction: true, lowRefill: true } });
  });

  server.put('/preferences', async (_request, reply) => {
    // TODO: Update notification preferences
    return reply.send({ message: 'Preferences updated' });
  });
}
