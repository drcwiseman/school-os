-- Subscription billing cadence per school
ALTER TABLE "tenant_plans" ADD COLUMN IF NOT EXISTS "billing_interval" text NOT NULL DEFAULT 'monthly';
ALTER TABLE "tenant_plans" ADD COLUMN IF NOT EXISTS "renews_at" timestamp;
ALTER TABLE "tenant_plans" ADD COLUMN IF NOT EXISTS "one_time_amount" integer;
--> statement-breakpoint
UPDATE "tenant_plans" SET "billing_interval" = 'monthly' WHERE "billing_interval" IS NULL OR "billing_interval" = '';
