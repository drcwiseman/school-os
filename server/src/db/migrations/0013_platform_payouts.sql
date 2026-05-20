CREATE TABLE IF NOT EXISTS "platform_payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "amount" integer NOT NULL,
  "currency" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "reference" text,
  "note" text,
  "period_from" timestamp,
  "period_to" timestamp,
  "created_by" uuid REFERENCES "platform_admins"("id") ON DELETE set null,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_payouts_tenant_idx" ON "platform_payouts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "platform_payouts_status_idx" ON "platform_payouts" ("status");
