import type { FastifyInstance } from 'fastify';

export async function emergencyRoutes(server: FastifyInstance): Promise<void> {
  server.get('/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    // TODO: Return public emergency card data (rate-limited, no auth)
    // This endpoint is scanned by first responders via QR code
    return reply.send({
      message: 'Emergency card stub',
      token,
      data: {
        medications: [],
        allergies: [],
        emergencyContacts: [],
        bloodType: null,
      },
    });
  });
}
