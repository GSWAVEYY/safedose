/**
 * Medication sync routes — zero-knowledge encrypted payload storage.
 *
 * The server NEVER decrypts medication data. It stores and returns the
 * encrypted_payload as an opaque blob. Decryption happens client-side only.
 *
 * Routes:
 *   GET    /medications        — return all sync records for authenticated user
 *   POST   /medications        — create sync record
 *   PUT    /medications/:id    — update sync record (by server ID)
 *   DELETE /medications/:id    — delete sync record
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { sha256 } from '../lib/crypto.js';
import { verifyJwt } from '../middleware/auth.js';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const createSyncSchema = z.object({
  localId: z.string().min(1).max(64, 'localId must be 64 characters or fewer'),
  encryptedPayload: z.string().min(1, 'encryptedPayload is required'),
  checksum: z.string().length(64, 'checksum must be a 64-character hex SHA-256 hash'),
});

const updateSyncSchema = z.object({
  localId: z.string().min(1).max(64).optional(),
  encryptedPayload: z.string().min(1, 'encryptedPayload is required'),
  checksum: z.string().length(64, 'checksum must be a 64-character hex SHA-256 hash'),
});

const paramsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

// ─── Route registration ───────────────────────────────────────────────────────

export async function medicationRoutes(server: FastifyInstance): Promise<void> {

  // ── GET /medications ──────────────────────────────────────────────────────
  // Return all encrypted sync records for the authenticated user.

  server.get('/', { preHandler: [verifyJwt] }, async (request, reply) => {
    const userId = request.user.id;

    const records = await prisma.medicationSync.findMany({
      where: { userId },
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        localId: true,
        encryptedPayload: true,
        checksum: true,
        updatedAt: true,
      },
    });

    return reply.status(200).send({
      success: true,
      medications: records.map((r: typeof records[number]) => ({
        id: r.id,
        localId: r.localId,
        encryptedPayload: r.encryptedPayload,
        checksum: r.checksum,
        updatedAt: r.updatedAt.toISOString(),
      })),
      total: records.length,
    });
  });

  // ── POST /medications ─────────────────────────────────────────────────────
  // Create or upsert an encrypted medication sync record.
  // The upsert on (userId, localId) allows idempotent retry from the client
  // without creating duplicate rows if the network response was lost.

  server.post('/', { preHandler: [verifyJwt] }, async (request, reply) => {
    const result = createSyncSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', issues: result.error.issues },
      });
    }

    const userId = request.user.id;
    const { localId, encryptedPayload, checksum } = result.data;

    // Verify the checksum the client sent matches the payload.
    // Server never inspects the plaintext — but it can verify integrity
    // of the encrypted blob itself using the provided hash.
    const serverChecksum = sha256(encryptedPayload);
    if (serverChecksum !== checksum) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'CHECKSUM_MISMATCH',
          message: 'Payload checksum does not match. The encrypted blob may be corrupted.',
        },
      });
    }

    const record = await prisma.medicationSync.upsert({
      where: { userId_localId: { userId, localId } },
      create: { userId, localId, encryptedPayload, checksum },
      update: { encryptedPayload, checksum },
      select: { id: true, localId: true, updatedAt: true },
    });

    return reply.status(201).send({
      success: true,
      id: record.id,
      localId: record.localId,
      updatedAt: record.updatedAt.toISOString(),
    });
  });

  // ── PUT /medications/:id ──────────────────────────────────────────────────
  // Update an existing encrypted sync record by server-assigned ID.

  server.put('/:id', { preHandler: [verifyJwt] }, async (request, reply) => {
    const paramsResult = paramsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', issues: paramsResult.error.issues },
      });
    }

    const bodyResult = updateSyncSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', issues: bodyResult.error.issues },
      });
    }

    const userId = request.user.id;
    const { id } = paramsResult.data;
    const { encryptedPayload, checksum } = bodyResult.data;

    // Verify checksum integrity before persisting
    const serverChecksum = sha256(encryptedPayload);
    if (serverChecksum !== checksum) {
      return reply.status(422).send({
        success: false,
        error: {
          code: 'CHECKSUM_MISMATCH',
          message: 'Payload checksum does not match.',
        },
      });
    }

    const existing = await prisma.medicationSync.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Medication sync record not found.' },
      });
    }

    const updated = await prisma.medicationSync.update({
      where: { id },
      data: { encryptedPayload, checksum },
      select: { id: true, localId: true, updatedAt: true },
    });

    return reply.status(200).send({
      success: true,
      id: updated.id,
      localId: updated.localId,
      updatedAt: updated.updatedAt.toISOString(),
    });
  });

  // ── DELETE /medications/:id ───────────────────────────────────────────────
  // Hard-delete a sync record. The client manages soft-delete locally in SQLite.

  server.delete('/:id', { preHandler: [verifyJwt] }, async (request, reply) => {
    const paramsResult = paramsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', issues: paramsResult.error.issues },
      });
    }

    const userId = request.user.id;
    const { id } = paramsResult.data;

    const existing = await prisma.medicationSync.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Medication sync record not found.' },
      });
    }

    await prisma.medicationSync.delete({ where: { id } });

    return reply.status(200).send({ success: true });
  });
}
