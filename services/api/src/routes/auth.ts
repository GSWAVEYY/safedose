/**
 * Auth routes for SafeDose API.
 *
 * POST /auth/register   — create account, return tokens
 * POST /auth/login      — verify credentials, return tokens
 * POST /auth/refresh    — rotate refresh token, return new pair
 * POST /auth/logout     — revoke refresh token
 * DELETE /auth/account  — soft-delete authenticated user
 *
 * Refresh tokens are stored as SHA-256 hashes. The raw token is sent to the
 * client once and never stored. Rotation: each /refresh call revokes the old
 * hash and issues a new pair.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import {
  hashPassword,
  verifyPassword,
  generateRefreshToken,
  hashRefreshToken,
  generateQrToken,
  REFRESH_TOKEN_TTL_MS,
} from '../lib/auth.js';
import { verifyJwt } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rate-limit.js';
import { writeAuditLog } from '../middleware/audit-log.js';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  phone: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .optional(),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be 100 characters or fewer'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.email !== undefined || data.phone !== undefined, {
  message: 'Either email or phone is required',
  path: ['email'],
});

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(1, 'Password is required'),
}).refine((data) => data.email !== undefined || data.phone !== undefined, {
  message: 'Either email or phone is required',
  path: ['email'],
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ─── Rate limit config (exported for testing) ─────────────────────────────────

export const REGISTER_RATE_LIMIT = { max: 10, timeWindow: '1 minute' } as const;
export const LOGIN_RATE_LIMIT = { max: 5, timeWindow: '1 minute' } as const;

// ─── Response helpers ─────────────────────────────────────────────────────────

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO — refresh token expiry for client storage
}

async function issueTokenPair(
  server: FastifyInstance,
  userId: string,
  email?: string | null,
  phone?: string | null
): Promise<TokenPair> {
  // Sign access token (15m TTL — configured at plugin registration)
  const accessToken = server.jwt.sign({ id: userId, email: email ?? undefined, phone: phone ?? undefined });

  // Generate refresh token, store only the hash
  const { raw, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken: raw,
    expiresAt: expiresAt.toISOString(),
  };
}

// ─── Route registration ───────────────────────────────────────────────────────

export async function authRoutes(server: FastifyInstance): Promise<void> {

  // ── POST /auth/register ───────────────────────────────────────────────────

  server.post('/register', {
    config: { rateLimit: REGISTER_RATE_LIMIT },
  }, async (request, reply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', issues: result.error.issues },
      });
    }

    const { email, phone, displayName, password } = result.data;

    // Check for existing account
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'ACCOUNT_EXISTS',
          message: 'An account with that email or phone already exists.',
        },
      });
    }

    const passwordHash = await hashPassword(password);
    const emergencyQrToken = generateQrToken();

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        displayName,
        passwordHash,
        emergencyQrToken,
      },
      select: { id: true, displayName: true, email: true, phone: true },
    });

    const tokens = await issueTokenPair(server, user.id, user.email, user.phone);

    return reply.status(201).send({
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email ?? null,
        phone: user.phone ?? null,
      },
      ...tokens,
    });
  });

  // ── POST /auth/login ──────────────────────────────────────────────────────

  server.post('/login', {
    config: { rateLimit: LOGIN_RATE_LIMIT },
  }, async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', issues: result.error.issues },
      });
    }

    const { email, phone, password } = result.data;

    const user = await prisma.user.findFirst({
      where: {
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        deletedAt: null,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        passwordHash: true,
      },
    });

    // Constant-time-ish: always run verifyPassword to prevent user enumeration
    const dummyHash = '$2b$12$invalidhashpaddingtomatchbcryptoutputlength1234567890';
    const isValid = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, dummyHash).then(() => false);

    if (!user || !isValid) {
      void writeAuditLog({ action: 'LOGIN_FAILURE', request });
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email/phone or password is incorrect.',
        },
      });
    }

    // Update last seen
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeen: new Date() },
    });

    const tokens = await issueTokenPair(server, user.id, user.email, user.phone);

    void writeAuditLog({ userId: user.id, action: 'LOGIN_SUCCESS', request });

    return reply.status(200).send({
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email ?? null,
        phone: user.phone ?? null,
      },
      ...tokens,
    });
  });

  // ── POST /auth/refresh ────────────────────────────────────────────────────

  server.post('/refresh', authRateLimit, async (request, reply) => {
    const result = refreshSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', issues: result.error.issues },
      });
    }

    const { refreshToken } = result.data;
    const tokenHash = hashRefreshToken(refreshToken);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { id: true, email: true, phone: true, deletedAt: true },
        },
      },
    });

    if (
      !stored ||
      stored.revokedAt !== null ||
      stored.expiresAt < new Date() ||
      stored.user.deletedAt !== null
    ) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid, expired, or already used.',
        },
      });
    }

    // Rotate: revoke old token, issue new pair atomically
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await issueTokenPair(
      server,
      stored.user.id,
      stored.user.email,
      stored.user.phone
    );

    return reply.status(200).send({ success: true, ...tokens });
  });

  // ── POST /auth/logout ─────────────────────────────────────────────────────

  server.post('/logout', authRateLimit, async (request, reply) => {
    const result = logoutSchema.safeParse(request.body);
    if (!result.success) {
      // Best-effort logout — don't fail the client if the body is missing
      return reply.status(200).send({ success: true });
    }

    const tokenHash = hashRefreshToken(result.data.refreshToken);

    // Revoke if it exists — silently ignore if not found
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return reply.status(200).send({ success: true });
  });

  // ── DELETE /auth/account ──────────────────────────────────────────────────

  server.delete('/account', { preHandler: [verifyJwt], config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = request.user.id;

    // Revoke all refresh tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Revoke all caregiver relationships (both sides — as patient and as caregiver)
    // so that former caregivers lose access immediately and the account has no
    // dangling active relationships after deletion.
    await prisma.caregiverRelationship.updateMany({
      where: {
        OR: [{ patientId: userId }, { caregiverId: userId }],
        status: { not: 'revoked' },
      },
      data: { status: 'revoked', inviteToken: null },
    });

    // Remove all device tokens to prevent ghost push notifications being sent
    // to a device belonging to a deleted account.
    await prisma.deviceToken.deleteMany({ where: { userId } });

    // Soft delete
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    void writeAuditLog({ userId: request.user.id, action: 'ACCOUNT_DELETED', request });

    return reply.status(200).send({ success: true });
  });
}
