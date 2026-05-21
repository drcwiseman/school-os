-- In-app system notifications + announcement delivery tracking

CREATE TABLE IF NOT EXISTS "system_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "link" text,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "system_notifications_tenant_user_idx" ON "system_notifications" ("tenant_id", "user_id");

ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "notify_channels" jsonb DEFAULT '[]'::jsonb;
