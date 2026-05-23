-- Student bio pending admin approval, directed portal messages, timetable types & publish

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "pending_profile_json" jsonb;

ALTER TABLE "portal_messages" ADD COLUMN IF NOT EXISTS "recipient_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "timetables" ADD COLUMN IF NOT EXISTS "timetable_type" text NOT NULL DEFAULT 'teaching';
ALTER TABLE "timetables" ADD COLUMN IF NOT EXISTS "is_published" boolean NOT NULL DEFAULT false;
ALTER TABLE "timetables" ADD COLUMN IF NOT EXISTS "generation_rules_json" jsonb;

CREATE INDEX IF NOT EXISTS "portal_messages_recipient_idx" ON "portal_messages" ("tenant_id", "recipient_user_id");
