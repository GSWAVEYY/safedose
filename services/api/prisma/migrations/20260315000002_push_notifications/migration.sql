-- Migration: push_notifications
-- Adds notification_preferences table and notification_sent flag on dose_events.
-- Safe for existing data: column defaults cover all existing rows.

-- 1. Add notification_sent column to dose_events
--    Default FALSE — existing rows are treated as not yet notified (correct,
--    since the push service was not yet live).
ALTER TABLE "dose_events"
  ADD COLUMN "notification_sent" BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add index to support the dose-monitor query pattern:
--    WHERE event_type = 'missed' AND notification_sent = false AND created_at > (now - 1hr)
CREATE INDEX "dose_events_event_type_notification_sent_created_at_idx"
  ON "dose_events" ("event_type", "notification_sent", "created_at");

-- 3. Create notification_preferences table
CREATE TABLE "notification_preferences" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID         NOT NULL,
  "missed_dose" BOOLEAN      NOT NULL DEFAULT TRUE,
  "new_med"     BOOLEAN      NOT NULL DEFAULT TRUE,
  "interaction" BOOLEAN      NOT NULL DEFAULT TRUE,
  "low_refill"  BOOLEAN      NOT NULL DEFAULT TRUE,

  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "notification_preferences_user_id_key" UNIQUE ("user_id")
);
