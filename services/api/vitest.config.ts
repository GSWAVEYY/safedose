/**
 * vitest.config.ts
 *
 * Vitest configuration for @safedose/api.
 *
 * Key decisions:
 * - environment: 'node' — API service has no DOM dependencies.
 * - resolve.extensions: includes '.ts' so vitest resolves the source
 *   TypeScript files referenced with '.js' extensions (NodeNext convention).
 * - globals: true — allows describe/it/expect without explicit imports.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js'],
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/index.ts'],
    },
  },
});
