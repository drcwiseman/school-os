CREATE TABLE IF NOT EXISTS "platform_email_templates" (
  "code" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL DEFAULT 'transactional',
  "subject" text NOT NULL,
  "body_html" text NOT NULL,
  "body_text" text,
  "variables_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "platform_email_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_code" text,
  "recipient" text NOT NULL,
  "subject" text NOT NULL,
  "status" text NOT NULL DEFAULT 'sent',
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_email_logs_created_idx" ON "platform_email_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "platform_email_logs_status_idx" ON "platform_email_logs" ("status");
