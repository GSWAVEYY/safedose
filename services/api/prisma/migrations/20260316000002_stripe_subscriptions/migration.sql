-- Migration: Add Stripe subscription fields to users table
-- Sprint 5: Free/Premium/Family tier billing

ALTER TABLE "users"
  ADD COLUMN "stripe_customer_id"     VARCHAR(255),
  ADD COLUMN "subscription_tier"      VARCHAR(32)  NOT NULL DEFAULT 'free',
  ADD COLUMN "subscription_status"    VARCHAR(32),
  ADD COLUMN "stripe_subscription_id" VARCHAR(255);

-- Unique constraint on stripe_customer_id — one Stripe customer per user
CREATE UNIQUE INDEX "users_stripe_customer_id_key"
  ON "users"("stripe_customer_id")
  WHERE "stripe_customer_id" IS NOT NULL;

-- Index for fast webhook lookups by subscription ID
CREATE INDEX "users_stripe_subscription_id_idx"
  ON "users"("stripe_subscription_id")
  WHERE "stripe_subscription_id" IS NOT NULL;

-- Index for subscription tier queries (e.g. count users per tier)
CREATE INDEX "users_subscription_tier_idx"
  ON "users"("subscription_tier");
