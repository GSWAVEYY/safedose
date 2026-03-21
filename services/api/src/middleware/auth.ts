import type { FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/jwt';

/**
 * Authentication middleware — verifies JWT from Authorization header.
 *
 * Usage: add `preHandler: [verifyJwt]` to any protected route.
 *
 * The @fastify/jwt plugin is registered in index.ts and adds:
 *   - request.jwtVerify()
 *   - fastify.jwt.sign()
 *   - request.user (decoded payload)
 *
 */
export async function verifyJwt(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid authentication token required.',
      },
    });
  }
}

// Augment @fastify/jwt's decoded token type
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      email?: string;
      phone?: string;
    };
    user: {
      id: string;
      email?: string;
      phone?: string;
    };
  }
}
