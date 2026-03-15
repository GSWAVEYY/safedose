import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  displayName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(8),
});

export async function authRoutes(server: FastifyInstance): Promise<void> {
  server.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    // TODO: Implement registration with bcrypt + JWT
    return reply.status(201).send({ message: 'Registration stub', user: { displayName: body.displayName } });
  });

  server.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    // TODO: Implement login with JWT + refresh tokens
    return reply.send({ message: 'Login stub', email: body.email });
  });

  server.post('/refresh', async (_request, reply) => {
    // TODO: Implement refresh token rotation
    return reply.send({ message: 'Refresh stub' });
  });

  server.post('/logout', async (_request, reply) => {
    // TODO: Invalidate refresh token
    return reply.send({ message: 'Logout stub' });
  });

  server.delete('/account', async (_request, reply) => {
    // TODO: Soft delete user account + cascade
    return reply.send({ message: 'Account deletion stub' });
  });
}
