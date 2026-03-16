/**
 * Caregiver invite + relationship routes.
 *
 * The invite flow is token-based: the patient generates an invite token
 * and shares it out-of-band (link / QR code). The recipient calls
 * POST /caregiving/accept with that token — no authentication required
 * for the accept step, but the caller must be authenticated to be linked
 * as the caregiver.
 *
 * Routes:
 *   POST   /caregiving/invite                — patient creates invite
 *   POST   /caregiving/accept               — caregiver accepts invite by token
 *   GET    /caregiving/relationships         — list all relationships for caller
 *   DELETE /caregiving/relationships/:id     — patient or caregiver revokes
 *   GET    /caregiving/feed                  — dose event feed for caregivers
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { generateSecureToken } from '../lib/crypto.js';
import { verifyJwt } from '../middleware/auth.js';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

export const inviteSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().min(10, 'Phone must be at least 10 digits').optional(),
  role: z.enum(['primary', 'observer', 'emergency_only'], {
    errorMap: () => ({ message: 'role must be primary, observer, or emergency_only' }),
  }),
}).refine(
  (d) => d.email !== undefined || d.phone !== undefined,
  { message: 'Either email or phone is required', path: ['email'] }
);

export const acceptSchema = z.object({
  inviteToken: z.string().length(32, 'inviteToken must be 32 characters'),
});

export const relationshipParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

// ─── Default permissions by role ──────────────────────────────────────────────

export function defaultPermissions(role: string): Record<string, boolean> {
  if (role === 'primary') {
    return {
      viewMedications: true,
      viewSchedule: true,
      viewDoseHistory: true,
      receiveMissedDoseAlerts: true,
      receiveRefillAlerts: true,
      receiveEmergencyAlerts: true,
      editMedications: true,
    };
  }
  if (role === 'observer') {
    return {
      viewMedications: true,
      viewSchedule: true,
      viewDoseHistory: true,
      receiveMissedDoseAlerts: true,
      receiveRefillAlerts: false,
      receiveEmergencyAlerts: true,
      editMedications: false,
    };
  }
  // emergency_only
  return {
    viewMedications: false,
    viewSchedule: false,
    viewDoseHistory: false,
    receiveMissedDoseAlerts: false,
    receiveRefillAlerts: false,
    receiveEmergencyAlerts: true,
    editMedications: false,
  };
}

// ─── Route registration ───────────────────────────────────────────────────────

export async function caregivingRoutes(server: FastifyInstance): Promise<void> {

  // ── POST /caregiving/invite ───────────────────────────────────────────────
  // Authenticated patient creates a pending invite with a unique token.
  // The inviteToken is returned to the client for out-of-band sharing.
  // A placeholder caregiverId of null is used until the invite is accepted.

  server.post('/invite', { preHandler: [verifyJwt] }, async (request, reply) => {
    const result = inviteSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', issues: result.error.issues },
      });
    }

    const patientId = request.user.id;
    const { role } = result.data;
    const inviteToken = generateSecureToken(16); // 32-char hex, fits VarChar(32)

    // Map the API role to the Prisma enum value
    const prismaRole = role === 'emergency_only' ? 'observer' : role as 'primary' | 'observer';

    const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const relationship = await prisma.caregiverRelationship.create({
      data: {
        patientId,
        caregiverId: null,
        role: prismaRole,
        status: 'pending',
        permissions: defaultPermissions(role),
        inviteToken,
        inviteExpiresAt,
      },
      select: {
        id: true,
        role: true,
        status: true,
        inviteToken: true,
        inviteExpiresAt: true,
        invitedAt: true,
      },
    });

    return reply.status(201).send({
      success: true,
      id: relationship.id,
      inviteToken: relationship.inviteToken,
      role: relationship.role,
      status: relationship.status,
      invitedAt: relationship.invitedAt.toISOString(),
      inviteExpiresAt: relationship.inviteExpiresAt?.toISOString() ?? null,
      // Clients can construct the deep link: safedose://accept?token=<inviteToken>
      inviteLink: `safedose://caregiving/accept?token=${relationship.inviteToken ?? ''}`,
    });
  });

  // ── POST /caregiving/accept ───────────────────────────────────────────────
  // Authenticated user (the prospective caregiver) accepts an invite by token.
  // The user must be authenticated so we can link their account as caregiverId.

  server.post('/accept', { preHandler: [verifyJwt] }, async (request, reply) => {
    const result = acceptSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', issues: result.error.issues },
      });
    }

    const caregiverId = request.user.id;
    const { inviteToken } = result.data;

    const relationship = await prisma.caregiverRelationship.findUnique({
      where: { inviteToken },
      select: {
        id: true,
        patientId: true,
        caregiverId: true,
        status: true,
        role: true,
        inviteExpiresAt: true,
      },
    });

    if (!relationship) {
      return reply.status(404).send({
        success: false,
        error: { code: 'INVITE_NOT_FOUND', message: 'Invite token is invalid or has expired.' },
      });
    }

    if (relationship.inviteExpiresAt && relationship.inviteExpiresAt < new Date()) {
      return reply.status(410).send({
        success: false,
        error: {
          code: 'INVITE_EXPIRED',
          message: 'This invite has expired. Please request a new one.',
        },
      });
    }

    if (relationship.status !== 'pending') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'INVITE_ALREADY_USED',
          message: `This invite has already been ${relationship.status}.`,
        },
      });
    }

    // Prevent a patient from accepting their own invite
    if (relationship.patientId === caregiverId) {
      return reply.status(422).send({
        success: false,
        error: { code: 'SELF_INVITE', message: 'You cannot accept your own caregiver invite.' },
      });
    }

    const updated = await prisma.caregiverRelationship.update({
      where: { id: relationship.id },
      data: {
        caregiverId,
        status: 'accepted',
        acceptedAt: new Date(),
        // Rotate the token out after use — prevents token replay
        inviteToken: null,
      },
      select: {
        id: true,
        patientId: true,
        caregiverId: true,
        role: true,
        status: true,
        acceptedAt: true,
      },
    });

    return reply.status(200).send({
      success: true,
      id: updated.id,
      patientId: updated.patientId,
      caregiverId: updated.caregiverId,
      role: updated.role,
      status: updated.status,
      acceptedAt: updated.acceptedAt?.toISOString() ?? null,
    });
  });

  // ── GET /caregiving/relationships ─────────────────────────────────────────
  // Return all relationships where the caller is the patient OR the caregiver.

  server.get('/relationships', { preHandler: [verifyJwt] }, async (request, reply) => {
    const userId = request.user.id;

    const [asPatient, asCaregiver] = await Promise.all([
      prisma.caregiverRelationship.findMany({
        where: { patientId: userId },
        include: {
          caregiver: {
            select: { id: true, displayName: true, email: true, phone: true },
          },
        },
        orderBy: { invitedAt: 'desc' },
      }),
      prisma.caregiverRelationship.findMany({
        where: { caregiverId: userId, status: 'accepted' },
        include: {
          patient: {
            select: { id: true, displayName: true, email: true, phone: true },
          },
        },
        orderBy: { acceptedAt: 'desc' },
      }),
    ]);

    const patientRelationships = asPatient.map((r: typeof asPatient[number]) => ({
      id: r.id,
      perspective: 'patient' as const,
      otherUserId: r.caregiver?.id ?? null,
      otherUserName: r.caregiver?.displayName ?? null,
      role: r.role,
      status: r.status,
      permissions: r.permissions,
      invitedAt: r.invitedAt.toISOString(),
      acceptedAt: r.acceptedAt?.toISOString() ?? null,
    }));

    const caregiverRelationships = asCaregiver.map((r: typeof asCaregiver[number]) => ({
      id: r.id,
      perspective: 'caregiver' as const,
      otherUserId: r.patient.id,
      otherUserName: r.patient.displayName,
      role: r.role,
      status: r.status,
      permissions: r.permissions,
      invitedAt: r.invitedAt.toISOString(),
      acceptedAt: r.acceptedAt?.toISOString() ?? null,
    }));

    return reply.status(200).send({
      success: true,
      relationships: [...patientRelationships, ...caregiverRelationships],
    });
  });

  // ── DELETE /caregiving/relationships/:id ──────────────────────────────────
  // Revoke a relationship. Either the patient or the caregiver may revoke.

  server.delete('/relationships/:id', { preHandler: [verifyJwt] }, async (request, reply) => {
    const paramsResult = relationshipParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', issues: paramsResult.error.issues },
      });
    }

    const userId = request.user.id;
    const { id } = paramsResult.data;

    const relationship = await prisma.caregiverRelationship.findFirst({
      where: {
        id,
        OR: [{ patientId: userId }, { caregiverId: userId }],
      },
      select: { id: true, status: true },
    });

    if (!relationship) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Relationship not found.' },
      });
    }

    if (relationship.status === 'revoked') {
      return reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_REVOKED', message: 'This relationship has already been revoked.' },
      });
    }

    await prisma.caregiverRelationship.update({
      where: { id },
      data: { status: 'revoked', inviteToken: null },
    });

    return reply.status(200).send({ success: true });
  });

  // ── GET /caregiving/feed ──────────────────────────────────────────────────
  // Return recent dose events for all patients the caller is a caregiver of.
  // Limited to last 50 events across all patients, ordered newest-first.

  server.get('/feed', { preHandler: [verifyJwt] }, async (request, reply) => {
    const caregiverId = request.user.id;

    // Find all patients for whom this user is an accepted caregiver
    // SECURITY: Only include patients where caregiver has viewDoseHistory permission
    const caregiverRelationships = await prisma.caregiverRelationship.findMany({
      where: { caregiverId, status: 'accepted' },
      select: { patientId: true, permissions: true },
    });

    if (caregiverRelationships.length === 0) {
      return reply.status(200).send({ success: true, events: [] });
    }

    // Filter to only patients where viewDoseHistory permission is granted
    const patientIds = caregiverRelationships
      .filter((r: typeof caregiverRelationships[number]) => {
        const perms =
          typeof r.permissions === 'object' && r.permissions !== null && !Array.isArray(r.permissions)
            ? (r.permissions as Record<string, unknown>)
            : {};
        return perms['viewDoseHistory'] === true;
      })
      .map((r: typeof caregiverRelationships[number]) => r.patientId);

    if (patientIds.length === 0) {
      return reply.status(200).send({ success: true, events: [] });
    }

    const events = await prisma.doseEvent.findMany({
      where: { patientId: { in: patientIds } },
      include: {
        patient: { select: { id: true, displayName: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 50,
    });

    return reply.status(200).send({
      success: true,
      events: events.map((e: typeof events[number]) => ({
        id: e.id,
        patientId: e.patientId,
        patientName: e.patient.displayName,
        medicationName: e.medicationName,
        eventType: e.eventType,
        scheduledAt: e.scheduledAt.toISOString(),
        confirmedAt: e.confirmedAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  });
}
