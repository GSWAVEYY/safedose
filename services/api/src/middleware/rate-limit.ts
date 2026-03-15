/**
 * Rate limiting configuration helpers.
 *
 * The @fastify/rate-limit plugin is registered globally in index.ts.
 * These helpers produce per-route overrides for sensitive endpoints.
 *
 * Why: auth endpoints (OTP send/verify) are the highest-risk surface
 * for abuse. Apply tighter limits there than on regular API routes.
 */

export const authRateLimit = {
  config: {
    rateLimit: {
      max: 5, // 5 requests
      timeWindow: '1 minute',
      errorResponseBuilder: () => ({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait before trying again.',
        },
      }),
    },
  },
} as const;

export const standardRateLimit = {
  config: {
    rateLimit: {
      max: 100,
      timeWindow: '1 minute',
      errorResponseBuilder: () => ({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down.',
        },
      }),
    },
  },
} as const;
