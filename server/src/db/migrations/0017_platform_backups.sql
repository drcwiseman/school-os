CREATE TABLE IF NOT EXISTS "platform_backups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "label" text NOT NULL,
  "trigger" text NOT NULL DEFAULT 'manual',
  "status" text NOT NULL DEFAULT 'pending',
  "includes_database" boolean NOT NULL DEFAULT true,
  "includes_uploads" boolean NOT NULL DEFAULT true,
  "file_name" text,
  "stored_path" text,
  "size_bytes" integer NOT NULL DEFAULT 0,
  "error" text,
  "created_by" uuid REFERENCES "platform_admins"("id") ON DELETE SET NULL,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_backups_status_idx" ON "platform_backups" ("status");
CREATE INDEX IF NOT EXISTS "platform_backups_created_idx" ON "platform_backups" ("created_at");
