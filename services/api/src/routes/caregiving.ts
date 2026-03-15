import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  role: z.enum(['primary', 'observer', 'emergency_only']),
});

export async function caregivingRoutes(server: FastifyInstance): Promise<void> {
  server.post('/invite', async (request, reply) => {
    const body = inviteSchema.parse(request.body);
    // TODO: Create caregiver invite with token
    return reply.status(201).send({ message: 'Invite sent', role: body.role });
  });

  server.post('/accept', async (_request, reply) => {
    // TODO: Accept caregiver invite with token
    return reply.send({ message: 'Invite accepted stub' });
  });

  server.get('/relationships', async (_request, reply) => {
    // TODO: Return caregiving relationships for authenticated user
    return reply.send({ relationships: [] });
  });

  server.delete('/relationships/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Revoke caregiver relationship
    return reply.send({ message: 'Relationship revoked', id });
  });

  server.get('/feed', async (_request, reply) => {
    // TODO: Real-time adherence feed for caregiver
    return reply.send({ events: [] });
  });
}
