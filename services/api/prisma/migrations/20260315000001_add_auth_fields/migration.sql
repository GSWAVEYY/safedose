-- Migration: add_auth_fields
-- Adds passwordHash + deletedAt to users, and creates refresh_tokens table.
-- Run: prisma migrate deploy (production) or prisma migrate dev (development)

-- Add auth columns to users
ALTER TABLE "users"
  ADD COLUMN "password_hash" VARCHAR(72) NOT NULL DEFAULT '',
  ADD COLUMN "deleted_at" TIMESTAMP;

-- Remove the temporary default — all new rows must supply a hash
ALTER TABLE "users"
  ALTER COLUMN "password_hash" DROP DEFAULT;

-- Refresh tokens table (for rotation + revocation)
CREATE TABLE "refresh_tokens" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID         NOT NULL,
  "token_hash" VARCHAR(64)  NOT NULL,
  "expires_at" TIMESTAMP    NOT NULL,
  "created_at" TIMESTAMP    NOT NULL DEFAULT now(),
  "revoked_at" TIMESTAMP,

  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "refresh_tokens_user_id_idx"    ON "refresh_tokens" ("user_id");
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" ("token_hash");
