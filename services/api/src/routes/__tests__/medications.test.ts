/**
 * Medication route tests — @safedose/api
 *
 * Tests the four route handlers registered in src/routes/medications.ts by
 * mounting them on a lightweight Fastify test server. No real database, crypto,
 * or JWT plugin is needed — all external dependencies are mocked.
 *
 * Mocking strategy:
 * - vi.mock('../../lib/db.js') — replaces the Prisma singleton with typed
 *   vi.fn() stubs. Each test configures return values via mockResolvedValueOnce.
 * - vi.mock('../../lib/crypto.js') — stubs sha256 so checksum tests control
 *   the server-side hash without requiring real crypto operations.
 * - vi.mock('../../middleware/auth.js') — stubs verifyJwt so authenticated
 *   tests skip JWT verification and set request.user directly, while
 *   unauthenticated tests return 401.
 * - vi.mock('../../middleware/feature-gate.js') — stubs checkMedicationLimit
 *   so tier-limit tests can throw TierLimitError on demand without a DB.
 *
 * Covers:
 * - GET /medications: authenticated returns 200 + records array, unauthenticated returns 401
 * - POST /medications: valid payload + matching checksum returns 201
 * - POST /medications: missing required fields returns 400 VALIDATION_ERROR
 * - POST /medications: checksum mismatch returns 422 CHECKSUM_MISMATCH
 * - POST /medications: tier limit exceeded returns 403 MEDICATION_LIMIT_REACHED
 * - PUT /medications/:id: valid payload + matching checksum returns 200
 * - PUT /medications/:id: invalid UUID param returns 400
 * - PUT /medications/:id: record not found returns 404
 * - PUT /medications/:id: checksum mismatch returns 422
 * - DELETE /medications/:id: existing record returns 200
 * - DELETE /medications/:id: not found returns 404
 * - DELETE /medications/:id: invalid UUID returns 400
 * - Auth rejection: all routes return 401 without a valid token
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ─── Hoist mocks before any import that touches Prisma, JWT, or crypto ────────

vi.mock('../../lib/db.js', () => ({
  prisma: {
    medicationSync: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../../lib/crypto.js', () => ({
  sha256: vi.fn(),
  generateSecureToken: vi.fn(() => 'a'.repeat(32)),
}));

// verifyJwt is mocked per-test via the mock factory below.
// The default export is an async fn that resolves immediately (authenticated).
// Individual tests that need unauthenticated behaviour override this inline.
vi.mock('../../middleware/auth.js', () => ({
  verifyJwt: vi.fn(async () => {
    // no-op by default — route handler reads request.user which is set by the
    // test server's onRequest hook (see buildServer helper below).
  }),
}));

vi.mock('../../middleware/feature-gate.js', () => ({
  checkMedicationLimit: vi.fn(async () => undefined),
  TierLimitError: class TierLimitError extends Error {
    public readonly code: string;
    public readonly requiredTier: string;
    public readonly currentTier: string;
    public readonly limitReached: number;

    constructor(opts: {
      message: string;
      code: string;
      requiredTier: string;
      currentTier: string;
      limitReached: number;
    }) {
      super(opts.message);
      this.name = 'TierLimitError';
      this.code = opts.code;
      this.requiredTier = opts.requiredTier;
      this.currentTier = opts.currentTier;
      this.limitReached = opts.limitReached;
    }
  },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { medicationRoutes } from '../medications.js';
import { prisma } from '../../lib/db.js';
import { sha256 } from '../../lib/crypto.js';
import { verifyJwt } from '../../middleware/auth.js';
import { checkMedicationLimit, TierLimitError } from '../../middleware/feature-gate.js';

// ─── Typed mock handles ───────────────────────────────────────────────────────

const mockFindMany = prisma.medicationSync.findMany as ReturnType<typeof vi.fn>;
const mockUpsert = prisma.medicationSync.upsert as ReturnType<typeof vi.fn>;
const mockFindFirst = prisma.medicationSync.findFirst as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.medicationSync.update as ReturnType<typeof vi.fn>;
const mockDelete = prisma.medicationSync.delete as ReturnType<typeof vi.fn>;
const mockSha256 = sha256 as ReturnType<typeof vi.fn>;
const mockVerifyJwt = verifyJwt as ReturnType<typeof vi.fn>;
const mockCheckLimit = checkMedicationLimit as ReturnType<typeof vi.fn>;

// ─── Test server factory ──────────────────────────────────────────────────────

/**
 * Build a minimal Fastify server that registers medicationRoutes under '/'.
 *
 * The onRequest hook sets request.user so route handlers that access
 * request.user.id after verifyJwt always have a valid user object available.
 * Tests that need unauthenticated behaviour override mockVerifyJwt to send 401.
 */
async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false });

  // Inject a synthetic user onto every request — verifyJwt mock will either
  // allow this to reach the handler, or short-circuit with 401.
  server.addHook('onRequest', async (request) => {
    (request as typeof request & { user: { id: string } }).user = {
      id: 'user-uuid-test-1234',
    };
  });

  await server.register(medicationRoutes, { prefix: '/' });
  await server.ready();
  return server;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_CHECKSUM = 'a'.repeat(64); // 64-char hex string matching schema constraint
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_PAYLOAD = 'dGVzdC1lbmNyeXB0ZWQtcGF5bG9hZA=='; // base64 stand-in

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Reset verifyJwt to the default no-op (authenticated)
  mockVerifyJwt.mockImplementation(async () => undefined);
});

let server: FastifyInstance;

afterEach(async () => {
  if (server) {
    await server.close();
  }
});

// ─── GET /medications ─────────────────────────────────────────────────────────

describe('GET /medications', () => {
  it('returns 200 with a medications array when authenticated', async () => {
    server = await buildServer();

    const fixedDate = new Date('2024-01-15T10:00:00.000Z');
    mockFindMany.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        localId: 'local-med-001',
        encryptedPayload: VALID_PAYLOAD,
        checksum: VALID_CHECKSUM,
        updatedAt: fixedDate,
      },
    ]);

    const response = await server.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      success: boolean;
      medications: Array<{
        id: string;
        localId: string;
        encryptedPayload: string;
        checksum: string;
        updatedAt: string;
      }>;
      total: number;
    }>();
    expect(body.success).toBe(true);
    expect(body.medications).toHaveLength(1);
    expect(body.medications[0]?.id).toBe(VALID_UUID);
    expect(body.medications[0]?.localId).toBe('local-med-001');
    expect(body.medications[0]?.updatedAt).toBe(fixedDate.toISOString());
    expect(body.total).toBe(1);
  });

  it('returns an empty medications array when the user has no records', async () => {
    server = await buildServer();
    mockFindMany.mockResolvedValueOnce([]);

    const response = await server.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ success: boolean; medications: unknown[]; total: number }>();
    expect(body.success).toBe(true);
    expect(body.medications).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('returns 401 when the request has no valid JWT', async () => {
    server = await buildServer();

    mockVerifyJwt.mockImplementation(async (_req: unknown, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Valid authentication token required.' },
      });
    });

    const response = await server.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

// ─── POST /medications ────────────────────────────────────────────────────────

describe('POST /medications', () => {
  it('returns 201 when payload is valid and checksum matches', async () => {
    server = await buildServer();

    const fixedDate = new Date('2024-01-15T11:00:00.000Z');
    mockSha256.mockReturnValueOnce(VALID_CHECKSUM);
    mockUpsert.mockResolvedValueOnce({
      id: VALID_UUID,
      localId: 'local-med-002',
      updatedAt: fixedDate,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/',
      headers: { 'content-type': 'application/json' },
      payload: {
        localId: 'local-med-002',
        encryptedPayload: VALID_PAYLOAD,
        checksum: VALID_CHECKSUM,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<{
      success: boolean;
      id: string;
      localId: string;
      updatedAt: string;
    }>();
    expect(body.success).toBe(true);
    expect(body.id).toBe(VALID_UUID);
    expect(body.localId).toBe('local-med-002');
    expect(body.updatedAt).toBe(fixedDate.toISOString());
  });

  it('returns 400 when localId is missing', async () => {
    server = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/',
      headers: { 'content-type': 'application/json' },
      payload: {
        encryptedPayload: VALID_PAYLOAD,
        checksum: VALID_CHECKSUM,
        // localId intentionally omitted
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when encryptedPayload is missing', async () => {
    server = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/',
      headers: { 'content-type': 'application/json' },
      payload: {
        localId: 'local-med-003',
        checksum: VALID_CHECKSUM,
        // encryptedPayload intentionally omitted
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when checksum is not 64 characters', async () => {
    server = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/',
      headers: { 'content-type': 'application/json' },
      payload: {
        localId: 'local-med-004',
        encryptedPayload: VALID_PAYLOAD,
        checksum: 'tooshort',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when body is empty', async () => {
    server = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when server-computed checksum does not match client checksum', async () => {
    server = await buildServer();

    // sha256 returns a different hash than what the client sent
    mockSha256.mockReturnValueOnce('b'.repeat(64));

    const response = await server.inject({
      method: 'POST',
      url: '/',
      headers: { 'content-type': 'application/json' },
      payload: {
        localId: 'local-med-005',
        encryptedPayload: VALID_PAYLOAD,
        checksum: VALID_CHECKSUM, // 'a' * 64 — won't match 'b' * 64
      },
    });

    expect(response.statusCode).toBe(422);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CHECKSUM_MISMATCH');
  });

  it('returns 403 when the free-tier medication limit is reached', async () => {
    server = await buildServer();

    mockCheckLimit.mockRejectedValueOnce(
      new TierLimitError({
        message: 'Free accounts are limited to 10 medications.',
        code: 'MEDICATION_LIMIT_REACHED',
        requiredTier: 'premium',
        currentTier: 'free',
        limitReached: 10,
      })
    );

    const response = await server.inject({
      method: 'POST',
      url: '/',
      headers: { 'content-type': 'application/json' },
      payload: {
        localId: 'local-med-006',
        encryptedPayload: VALID_PAYLOAD,
        checksum: VALID_CHECKSUM,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json<{
      success: boolean;
      error: { code: string; requiredTier: string; currentTier: string };
    }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('MEDICATION_LIMIT_REACHED');
    expect(body.error.requiredTier).toBe('premium');
    expect(body.error.currentTier).toBe('free');
  });

  it('returns 401 when the request has no valid JWT', async () => {
    server = await buildServer();

    mockVerifyJwt.mockImplementation(async (_req: unknown, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Valid authentication token required.' },
      });
    });

    const response = await server.inject({
      method: 'POST',
      url: '/',
      headers: { 'content-type': 'application/json' },
      payload: {
        localId: 'local-med-007',
        encryptedPayload: VALID_PAYLOAD,
        checksum: VALID_CHECKSUM,
      },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

// ─── PUT /medications/:id ─────────────────────────────────────────────────────

describe('PUT /medications/:id', () => {
  it('returns 200 when the record exists and checksum matches', async () => {
    server = await buildServer();

    const fixedDate = new Date('2024-01-15T12:00:00.000Z');
    mockSha256.mockReturnValueOnce(VALID_CHECKSUM);
    mockFindFirst.mockResolvedValueOnce({ id: VALID_UUID });
    mockUpdate.mockResolvedValueOnce({
      id: VALID_UUID,
      localId: 'local-med-008',
      updatedAt: fixedDate,
    });

    const response = await server.inject({
      method: 'PUT',
      url: `/${VALID_UUID}`,
      headers: { 'content-type': 'application/json' },
      payload: {
        encryptedPayload: VALID_PAYLOAD,
        checksum: VALID_CHECKSUM,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      success: boolean;
      id: string;
      localId: string;
      updatedAt: string;
    }>();
    expect(body.success).toBe(true);
    expect(body.id).toBe(VALID_UUID);
    expect(body.updatedAt).toBe(fixedDate.toISOString());
  });

  it('returns 400 when the id param is not a valid UUID', async () => {
    server = await buildServer();

    const response = await server.inject({
      method: 'PUT',
      url: '/not-a-uuid',
      headers: { 'content-type': 'application/json' },
      payload: {
        encryptedPayload: VALID_PAYLOAD,
        checksum: VALID_CHECKSUM,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when encryptedPayload is missing in body', async () => {
    server = await buildServer();

    const response = await server.inject({
      method: 'PUT',
      url: `/${VALID_UUID}`,
      headers: { 'content-type': 'application/json' },
      payload: {
        checksum: VALID_CHECKSUM,
        // encryptedPayload intentionally omitted
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when checksum does not match the encrypted payload', async () => {
    server = await buildServer();

    // Server computes a different hash than the client sent
    mockSha256.mockReturnValueOnce('c'.repeat(64));

    const response = await server.inject({
      method: 'PUT',
      url: `/${VALID_UUID}`,
      headers: { 'content-type': 'application/json' },
      payload: {
        encryptedPayload: VALID_PAYLOAD,
        checksum: VALID_CHECKSUM,
      },
    });

    expect(response.statusCode).toBe(422);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CHECKSUM_MISMATCH');
  });

  it('returns 404 when the record does not belong to the authenticated user', async () => {
    server = await buildServer();

    mockSha256.mockReturnValueOnce(VALID_CHECKSUM);
    mockFindFirst.mockResolvedValueOnce(null); // record not found / not owned

    const response = await server.inject({
      method: 'PUT',
      url: `/${VALID_UUID}`,
      headers: { 'content-type': 'application/json' },
      payload: {
        encryptedPayload: VALID_PAYLOAD,
        checksum: VALID_CHECKSUM,
      },
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 when the request has no valid JWT', async () => {
    server = await buildServer();

    mockVerifyJwt.mockImplementation(async (_req: unknown, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Valid authentication token required.' },
      });
    });

    const response = await server.inject({
      method: 'PUT',
      url: `/${VALID_UUID}`,
      headers: { 'content-type': 'application/json' },
      payload: {
        encryptedPayload: VALID_PAYLOAD,
        checksum: VALID_CHECKSUM,
      },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

// ─── DELETE /medications/:id ──────────────────────────────────────────────────

describe('DELETE /medications/:id', () => {
  it('returns 200 when the record exists and belongs to the user', async () => {
    server = await buildServer();

    mockFindFirst.mockResolvedValueOnce({ id: VALID_UUID });
    mockDelete.mockResolvedValueOnce({ id: VALID_UUID });

    const response = await server.inject({
      method: 'DELETE',
      url: `/${VALID_UUID}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  });

  it('returns 404 when the record does not belong to the authenticated user', async () => {
    server = await buildServer();

    mockFindFirst.mockResolvedValueOnce(null);

    const response = await server.inject({
      method: 'DELETE',
      url: `/${VALID_UUID}`,
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when the id param is not a valid UUID', async () => {
    server = await buildServer();

    const response = await server.inject({
      method: 'DELETE',
      url: '/not-a-uuid',
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when the request has no valid JWT', async () => {
    server = await buildServer();

    mockVerifyJwt.mockImplementation(async (_req: unknown, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Valid authentication token required.' },
      });
    });

    const response = await server.inject({
      method: 'DELETE',
      url: `/${VALID_UUID}`,
    });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ success: boolean; error: { code: string } }>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

// ─── Auth rejection invariants ────────────────────────────────────────────────

describe('Auth rejection — all protected routes return 401 without a valid token', () => {
  beforeEach(() => {
    mockVerifyJwt.mockImplementation(async (_req: unknown, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Valid authentication token required.' },
      });
    });
  });

  it('GET / returns 401', async () => {
    server = await buildServer();
    const response = await server.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(401);
  });

  it('POST / returns 401', async () => {
    server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/',
      headers: { 'content-type': 'application/json' },
      payload: { localId: 'x', encryptedPayload: 'y', checksum: 'z'.repeat(64) },
    });
    expect(response.statusCode).toBe(401);
  });

  it('PUT /:id returns 401', async () => {
    server = await buildServer();
    const response = await server.inject({
      method: 'PUT',
      url: `/${VALID_UUID}`,
      headers: { 'content-type': 'application/json' },
      payload: { encryptedPayload: 'y', checksum: 'z'.repeat(64) },
    });
    expect(response.statusCode).toBe(401);
  });

  it('DELETE /:id returns 401', async () => {
    server = await buildServer();
    const response = await server.inject({
      method: 'DELETE',
      url: `/${VALID_UUID}`,
    });
    expect(response.statusCode).toBe(401);
  });
});
