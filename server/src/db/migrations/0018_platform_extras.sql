ALTER TABLE "platform_backups" ADD COLUMN IF NOT EXISTS "offsite_key" text;
ALTER TABLE "platform_backups" ADD COLUMN IF NOT EXISTS "offsite_status" text;

CREATE TABLE IF NOT EXISTS "platform_email_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "subject" text NOT NULL,
  "body_html" text NOT NULL DEFAULT '',
  "body_text" text,
  "audience" text NOT NULL DEFAULT 'operators',
  "recipient_emails" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'draft',
  "scheduled_at" timestamp,
  "sent_at" timestamp,
  "stats" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" uuid REFERENCES "platform_admins"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_email_campaigns_status_idx" ON "platform_email_campaigns" ("status");

CREATE TABLE IF NOT EXISTS "platform_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "external_id" text NOT NULL,
  "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL,
  "payment_id" uuid REFERENCES "payments"("id") ON DELETE SET NULL,
  "invoice_id" uuid REFERENCES "invoices"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'processed',
  "payload" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_webhook_events_provider_ext_idx"
  ON "platform_webhook_events" ("provider", "external_id");
