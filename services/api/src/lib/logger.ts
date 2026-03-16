/**
 * Structured logger — pino singleton shared across the API.
 *
 * Usage:
 *   import { logger } from './logger.js';
 *   logger.info('message');
 *   logger.error({ err }, 'something failed');
 *
 * LOG_LEVEL env var controls verbosity (default: 'info').
 * Valid values: trace | debug | info | warn | error | fatal | silent
 */

import pino from 'pino';

export const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info' });
