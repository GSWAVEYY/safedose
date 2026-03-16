/**
 * vitest.config.ts
 *
 * Vitest configuration for @safedose/mobile.
 *
 * Key decisions:
 * - environment: 'node' — tests run in Node, not jsdom. The interaction engine
 *   has no DOM dependencies. React Native / Expo Native modules are mocked at
 *   the file level using vi.mock().
 * - resolve.tsconfigPaths: true — Vite 5+ native tsconfig path resolution,
 *   handles the @/* aliases defined in tsconfig.json.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/__tests__/**'],
    },
  },
});
