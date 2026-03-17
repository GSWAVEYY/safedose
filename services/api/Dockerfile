# SafeDose API — Multi-stage Dockerfile
# Build context must be the monorepo root, not services/api/.
# Fly.io deploys from the directory containing fly.toml, so the build context
# is services/api/ — but we need the workspace root for pnpm workspaces.
# Solution: fly.toml sets [build] dockerfile = "Dockerfile" which Fly resolves
# relative to the fly.toml location. We set the build context via `fly deploy`
# using --build-arg or by placing fly.toml at the root level.
#
# IMPORTANT: Run `fly deploy` from the MONOREPO ROOT, not from services/api/.
# The deploy script (scripts/deploy-api.sh) handles this correctly.

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
# Install production dependencies only. This layer is cached as long as
# lockfile and package.json files don't change — keeping rebuilds fast.
FROM node:20-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy manifests first — Docker cache skips RUN if these don't change
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/api/package.json ./services/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/

RUN pnpm install --frozen-lockfile --prod

# ─── Stage 2: build ───────────────────────────────────────────────────────────
# Full install (including devDependencies) to compile TypeScript.
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY services/api/ ./services/api/
COPY packages/shared-types/ ./packages/shared-types/
COPY packages/shared-utils/ ./packages/shared-utils/

RUN pnpm install --frozen-lockfile

# Generate Prisma client BEFORE compiling TypeScript — tsc needs the generated
# types from @prisma/client to succeed. Without this the build fails with
# "Cannot find module '.prisma/client'" errors.
RUN pnpm --filter @safedose/api run prisma:generate

# Compile shared packages first, then the API (dependency order matters)
RUN pnpm --filter @safedose/shared-types run build 2>/dev/null || true
RUN pnpm --filter @safedose/shared-utils run build 2>/dev/null || true
RUN pnpm --filter @safedose/api run build

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
# Minimal production image — only the compiled output and prod node_modules.
# No source files, no devDependencies, no TypeScript toolchain.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/api/node_modules ./services/api/node_modules

# Copy compiled output
COPY --from=build /app/services/api/dist ./services/api/dist

# Copy Prisma schema + generated client so runtime migrations work
# The generated client lives inside node_modules, but the schema is needed
# for any runtime Prisma calls that inspect the schema (e.g. db push)
COPY --from=build /app/services/api/prisma ./services/api/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Copy shared package compiled output (runtime imports)
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/shared-utils/dist ./packages/shared-utils/dist

EXPOSE 3001

# Docker-level health check — Fly.io also has its own checks in fly.toml,
# but this ensures the container is healthy when used outside Fly too.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "services/api/dist/index.js"]
