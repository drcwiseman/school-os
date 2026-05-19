-- Phase 16–19: SaaS ecosystem (domains, impersonation, addons, usage billing)
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "custom_domain" text;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subdomain" text;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "domain_verified" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ssl_config" jsonb NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_campuses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "address" text DEFAULT '',
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_campuses_tenant_idx" ON "tenant_campuses" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "addon_features" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "price_monthly" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "addon_features_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_addons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "addon_id" uuid NOT NULL REFERENCES "addon_features"("id") ON DELETE cascade,
  "status" text NOT NULL DEFAULT 'active',
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_addons_tenant_addon_idx" UNIQUE("tenant_id","addon_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_billing_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "metric" text NOT NULL,
  "quantity_used" integer NOT NULL DEFAULT 0,
  "billing_cycle" text NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_billing_usage_metric_idx" UNIQUE("tenant_id","metric","billing_cycle")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_billing_thresholds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "metric" text NOT NULL,
  "included_quantity" integer NOT NULL DEFAULT 0,
  "overage_unit_price" integer NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'USD',
  CONSTRAINT "usage_billing_thresholds_metric_unique" UNIQUE("metric")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_billing_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "billing_cycle" text NOT NULL,
  "line_type" text NOT NULL,
  "description" text NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_amount" integer NOT NULL DEFAULT 0,
  "amount" integer NOT NULL DEFAULT 0,
  "metric" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saas_billing_lines_tenant_cycle_idx" ON "saas_billing_lines" ("tenant_id","billing_cycle");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "platform_admin_id" uuid REFERENCES "platform_admins"("id") ON DELETE set null,
  "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE set null,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "before_json" jsonb,
  "after_json" jsonb,
  "ip" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_audit_logs_created_idx" ON "platform_audit_logs" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_impersonation_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "target_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "platform_admin_id" uuid NOT NULL REFERENCES "platform_admins"("id") ON DELETE cascade,
  "read_only" boolean NOT NULL DEFAULT true,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "platform_impersonation_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
INSERT INTO "addon_features" ("code", "name", "description", "price_monthly") VALUES
  ('ai_homework', 'AI Homework Assistant', 'AI grading and feedback', 2900),
  ('white_label', 'White-Label Branding', 'Custom domain and branding', 4900),
  ('multi_campus', 'Multi-Campus', 'Branch campuses under one school', 9900)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "usage_billing_thresholds" ("metric", "included_quantity", "overage_unit_price", "currency") VALUES
  ('sms_volume', 500, 5, 'USD'),
  ('ai_credits', 1000, 2, 'USD'),
  ('storage_bytes', 5368709120, 1, 'USD')
ON CONFLICT ("metric") DO NOTHING;
--> statement-breakpoint
INSERT INTO "features" ("code", "name", "description") VALUES
  ('ai_homework', 'AI Homework', 'AI-assisted homework and grading'),
  ('white_label', 'White Label', 'Custom domain and branding'),
  ('multi_campus', 'Multi-Campus', 'Multiple branch campuses')
ON CONFLICT ("code") DO NOTHING;
