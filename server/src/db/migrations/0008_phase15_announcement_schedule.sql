-- Phase 15: optional scheduled publish time for announcements
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "publish_at" timestamp;
