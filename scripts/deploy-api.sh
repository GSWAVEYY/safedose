#!/bin/bash
# SafeDose API — Fly.io Deployment Script
#
# Usage:
#   ./scripts/deploy-api.sh              # Deploy from monorepo root
#   ./scripts/deploy-api.sh --dry-run    # Validate config without deploying
#
# Prerequisites:
#   - fly CLI installed: https://fly.io/docs/hands-on/install-flyctl/
#   - Authenticated: fly auth login
#   - Secrets already set (first time only):
#       fly secrets set DATABASE_URL="postgresql://..." --app safedose-api
#       fly secrets set JWT_SECRET="$(openssl rand -base64 32)" --app safedose-api
#       fly secrets set CORS_ORIGIN="https://safedose.app" --app safedose-api
#       fly secrets set ENCRYPTION_KEY="<64-char hex>" --app safedose-api
#       fly secrets set STRIPE_SECRET_KEY="sk_live_..." --app safedose-api
#       fly secrets set STRIPE_WEBHOOK_SECRET="whsec_..." --app safedose-api
#       fly secrets set STRIPE_PREMIUM_MONTHLY_PRICE_ID="price_..." --app safedose-api
#       fly secrets set STRIPE_PREMIUM_ANNUAL_PRICE_ID="price_..." --app safedose-api
#       fly secrets set STRIPE_FAMILY_MONTHLY_PRICE_ID="price_..." --app safedose-api
#       fly secrets set STRIPE_FAMILY_ANNUAL_PRICE_ID="price_..." --app safedose-api
#
# Database migrations:
#   Run migrations against Neon BEFORE deploying a new schema:
#       DATABASE_URL="postgresql://..." npx prisma migrate deploy
#   The deploy script does NOT auto-migrate — migrations are a deliberate
#   manual step to prevent accidental data loss in production.

set -euo pipefail

# ─── Resolve monorepo root ────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "SafeDose API — Fly.io Deploy"
echo "Repo root: ${REPO_ROOT}"
echo ""

# ─── Dry run check ────────────────────────────────────────────────────────────
DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[DRY RUN] Config validation only — no deploy will happen."
  echo ""
fi

# ─── Pre-flight checks ────────────────────────────────────────────────────────
echo "Running pre-flight checks..."

if ! command -v fly &>/dev/null; then
  echo "ERROR: fly CLI not found. Install: https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

if ! fly auth whoami &>/dev/null; then
  echo "ERROR: Not authenticated with Fly.io. Run: fly auth login"
  exit 1
fi

FLY_TOML="${REPO_ROOT}/services/api/fly.toml"
if [[ ! -f "${FLY_TOML}" ]]; then
  echo "ERROR: fly.toml not found at ${FLY_TOML}"
  exit 1
fi

echo "fly CLI: $(fly version)"
echo "Authenticated as: $(fly auth whoami)"
echo "fly.toml: ${FLY_TOML}"
echo ""

# ─── TypeScript type-check ────────────────────────────────────────────────────
echo "Running TypeScript check..."
cd "${REPO_ROOT}"
pnpm --filter @safedose/api run typecheck
echo "TypeScript: clean"
echo ""

# ─── Prisma client generation ─────────────────────────────────────────────────
# The Dockerfile handles this in the build stage, but generating locally ensures
# the schema is valid and the client types match before we push to Fly.
echo "Validating Prisma schema..."
cd "${REPO_ROOT}/services/api"
npx prisma validate
echo "Prisma schema: valid"
echo ""

# ─── Deploy ───────────────────────────────────────────────────────────────────
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[DRY RUN] Pre-flight checks passed. Ready to deploy."
  echo "Run without --dry-run to deploy."
  exit 0
fi

echo "Deploying to Fly.io..."
echo "Build context: ${REPO_ROOT} (monorepo root required for pnpm workspaces)"
echo ""

# --remote-only: Fly builds the image on their infrastructure, not locally.
# This avoids needing Docker installed locally and reduces build time.
# The build context is the monorepo root so the Dockerfile can COPY workspace packages.
cd "${REPO_ROOT}"
fly deploy \
  --config "${FLY_TOML}" \
  --dockerfile "${REPO_ROOT}/services/api/Dockerfile" \
  --remote-only \
  --app safedose-api

echo ""
echo "Deploy complete. Running post-deploy checks..."
echo ""

# ─── Post-deploy verification ─────────────────────────────────────────────────
fly status --app safedose-api

echo ""
echo "Health check:"
sleep 5  # Give the new machine a moment to boot
fly ssh console --app safedose-api --command "wget -qO- http://localhost:3001/health" 2>/dev/null \
  || echo "(SSH health check skipped — check Fly dashboard for health status)"

echo ""
echo "Deployment complete."
echo "API URL: https://safedose-api.fly.dev"
echo "Logs:    fly logs --app safedose-api"
echo "Status:  fly status --app safedose-api"
