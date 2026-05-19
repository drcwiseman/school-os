import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Idempotent fixes for VPS DBs that lag behind code. Runs once at server boot.
 */
export async function ensureRuntimeSchema() {
  const statements = [
    `ALTER TABLE "platform_admins" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'super_admin'`,
    `ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "publish_at" timestamp`,
    `CREATE TABLE IF NOT EXISTS "features" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "code" text NOT NULL,
      "name" text NOT NULL,
      "description" text DEFAULT '' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "features_code_unique" UNIQUE("code")
    )`,
    `CREATE TABLE IF NOT EXISTS "tenant_features" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
      "feature_id" uuid NOT NULL REFERENCES "features"("id") ON DELETE cascade,
      "enabled" boolean DEFAULT true NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "tenant_features_tenant_feature_unique" UNIQUE("tenant_id","feature_id")
    )`,
    `CREATE INDEX IF NOT EXISTS "tenant_features_tenant_idx" ON "tenant_features" ("tenant_id")`,
    `INSERT INTO "features" ("code", "name", "description") VALUES
      ('results_visible', 'Results visible to portal', 'Parents/students can see published results when other rules pass'),
      ('fees_must_be_clear', 'Fees must be clear', 'Block portal results until invoices are paid'),
      ('portal_enabled', 'Parent/student portal', 'Enable portal logins for this school'),
      ('messaging_enabled', 'Messaging module', 'SMS/email campaigns and announcements')
    ON CONFLICT ("code") DO NOTHING`,
    `CREATE TABLE IF NOT EXISTS "parent_accounts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
      "email" text NOT NULL,
      "password_hash" text NOT NULL,
      "guardian_id" uuid NOT NULL REFERENCES "guardians"("id") ON DELETE cascade,
      "status" "user_status" DEFAULT 'active' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "parent_accounts_tenant_email_unique" UNIQUE("tenant_id","email")
    )`,
    `CREATE TABLE IF NOT EXISTS "student_accounts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
      "email" text NOT NULL,
      "password_hash" text NOT NULL,
      "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
      "status" "user_status" DEFAULT 'active' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "student_accounts_tenant_email_unique" UNIQUE("tenant_id","email")
    )`,
    `CREATE TABLE IF NOT EXISTS "platform_sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "admin_id" uuid NOT NULL REFERENCES "platform_admins"("id") ON DELETE cascade,
      "token" text NOT NULL,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "platform_sessions_token_unique" UNIQUE("token")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "platform_sessions_token_idx" ON "platform_sessions" ("token")`,
    `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "custom_domain" text`,
    `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subdomain" text`,
    `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "domain_verified" boolean NOT NULL DEFAULT false`,
    `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ssl_config" jsonb NOT NULL DEFAULT '{}'`,
    `CREATE TABLE IF NOT EXISTS "tenant_campuses" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
      "name" text NOT NULL,
      "code" text NOT NULL,
      "address" text DEFAULT '',
      "status" text DEFAULT 'active' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "addon_features" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "code" text NOT NULL,
      "name" text NOT NULL,
      "description" text DEFAULT '' NOT NULL,
      "price_monthly" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "addon_features_code_unique" UNIQUE("code")
    )`,
    `CREATE TABLE IF NOT EXISTS "tenant_addons" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
      "addon_id" uuid NOT NULL REFERENCES "addon_features"("id") ON DELETE cascade,
      "status" text DEFAULT 'active' NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "tenant_addons_tenant_addon_idx" UNIQUE("tenant_id", "addon_id")
    )`,
    `CREATE TABLE IF NOT EXISTS "tenant_billing_usage" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
      "metric" text NOT NULL,
      "quantity_used" integer DEFAULT 0 NOT NULL,
      "billing_cycle" text NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "tenant_billing_usage_metric_idx" UNIQUE("tenant_id", "metric", "billing_cycle")
    )`,
    `INSERT INTO "addon_features" ("code", "name", "description", "price_monthly") VALUES
      ('ai_homework', 'AI Homework Assistant', 'AI homework auto-grading and personalized feedback loops', 2900),
      ('white_label', 'White-Label Branding', 'Full custom domain, SMTP mail transport, and customized logo assets', 4900),
      ('multi_campus', 'Multi-Campus Nodes Scaling', 'Manage distinct geographical branches under a centralized dashboard', 9900)
    ON CONFLICT ("code") DO NOTHING`,
  ];

  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
    } catch (err) {
      console.warn("[ensureRuntimeSchema] skipped:", (err as Error).message?.slice(0, 120));
    }
  }
}
