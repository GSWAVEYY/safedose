import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { prisma } from '../lib/db.js';

/**
 * Audit log hook — records security-relevant actions.
 *
 * Usage: add as an `onSend` or `preHandler` hook on sensitive routes.
 * Or call writeAuditLog() directly from route handlers for explicit control.
 *
 * PLACEHOLDER — Sprint 2 will wire this up to all auth + caregiver endpoints.
 */

export interface AuditEvent {
  userId?: string;
  actorId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  request: FastifyRequest;
}

export async function writeAuditLog(event: AuditEvent): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: event.userId ?? null,
      actorId: event.actorId ?? null,
      action: event.action,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      ipAddress: event.request.ip ?? null,
      userAgent: (event.request.headers['user-agent'] as string | undefined) ?? null,
    },
  });
}

/**
 * onRequest hook that logs every incoming request at DEBUG level.
 * For production audit trails, use writeAuditLog() on specific actions.
 */
export function requestLogger(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  request.log.debug({ method: request.method, url: request.url }, 'incoming request');
  done();
}
