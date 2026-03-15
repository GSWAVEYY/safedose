import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const medicationSyncSchema = z.object({
  localId: z.string().min(1),
  encryptedPayload: z.string().min(1),
  checksum: z.string().min(1),
});

export async function medicationRoutes(server: FastifyInstance): Promise<void> {
  server.get('/', async (_request, reply) => {
    // TODO: Return encrypted medication list for authenticated user
    return reply.send({ medications: [], total: 0 });
  });

  server.post('/', async (request, reply) => {
    const body = medicationSyncSchema.parse(request.body);
    // TODO: Create encrypted medication sync record
    return reply.status(201).send({ message: 'Medication sync created', localId: body.localId });
  });

  server.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = medicationSyncSchema.parse(request.body);
    // TODO: Update encrypted medication sync record
    return reply.send({ message: 'Medication sync updated', id, localId: body.localId });
  });

  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Delete medication sync record
    return reply.send({ message: 'Medication sync deleted', id });
  });
}
