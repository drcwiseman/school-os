import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { FEATURE_CATALOG } from "../lib/feature-catalog";
import { splitMigrationSql } from "./sql-runner";
import { applyVpsSchemaPatch } from "./vps-schema-patch";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function runMigrationFile(filename: string) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  if (!fs.existsSync(filePath)) return;
  const parts = splitMigrationSql(fs.readFileSync(filePath, "utf8"));
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      await db.execute(sql.raw(trimmed));
    } catch (err) {
      console.warn(`[ensureRuntimeSchema] ${filename}:`, (err as Error).message?.slice(0, 100));
    }
  }
}

/**
 * Idempotent fixes for VPS DBs that lag behind code. Runs once at server boot.
 */
export async function ensureRuntimeSchema() {
  await applyVpsSchemaPatch(async (stmt) => {
    try {
      await db.execute(sql.raw(stmt));
    } catch (err) {
      console.warn("[ensureRuntimeSchema] patch:", (err as Error).message?.slice(0, 120));
    }
  });

  const statements = [
    `ALTER TABLE "platform_backups" ADD COLUMN IF NOT EXISTS "offsite_key" text`,
    `ALTER TABLE "platform_backups" ADD COLUMN IF NOT EXISTS "offsite_status" text`,
    `ALTER TABLE "platform_admins" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'super_admin'`,
    `ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "publish_at" timestamp`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "blood_group" text`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "phone" text`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "email" text`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "address" text`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "short_bio" text`,
    `ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'`,
    `CREATE TABLE IF NOT EXISTS "platform_audit_logs" (
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
    )`,
    `CREATE INDEX IF NOT EXISTS "platform_audit_logs_created_idx" ON "platform_audit_logs" ("created_at")`,
    `CREATE TABLE IF NOT EXISTS "platform_impersonation_tokens" (
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
    )`,
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
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "campus_id" uuid REFERENCES "tenant_campuses"("id") ON DELETE SET NULL`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean NOT NULL DEFAULT false`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret" text`,
    `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "campus_id" uuid REFERENCES "tenant_campuses"("id") ON DELETE SET NULL`,
    `ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "campus_id" uuid REFERENCES "tenant_campuses"("id") ON DELETE SET NULL`,
    `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "campus_id" uuid REFERENCES "tenant_campuses"("id") ON DELETE SET NULL`,
    `ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp`,
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
    `UPDATE "platform_settings" SET "value" = '{"displayCurrency":"UGX"}'::jsonb, "updated_at" = now()
      WHERE "key" = 'defaults' AND COALESCE("value"->>'displayCurrency', 'USD') = 'USD'`,
    `INSERT INTO "platform_settings" ("key", "value") VALUES ('defaults', '{"displayCurrency":"UGX"}')
      ON CONFLICT ("key") DO NOTHING`,
    `INSERT INTO "addon_features" ("code", "name", "description", "price_monthly") VALUES
      ('ai_homework', 'AI Homework Assistant', 'AI homework auto-grading and personalized feedback loops', 2900),
      ('white_label', 'White-Label Branding', 'Full custom domain, SMTP mail transport, and customized logo assets', 4900),
      ('multi_campus', 'Multi-Campus Nodes Scaling', 'Manage distinct geographical branches under a centralized dashboard', 9900)
    ON CONFLICT ("code") DO NOTHING`,
    `ALTER TABLE "features" ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'modules'`,
    `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "smtp_settings_json" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    `ALTER TABLE "tenant_plans" ADD COLUMN IF NOT EXISTS "billing_interval" text NOT NULL DEFAULT 'monthly'`,
    `ALTER TABLE "tenant_plans" ADD COLUMN IF NOT EXISTS "renews_at" timestamp`,
    `ALTER TABLE "tenant_plans" ADD COLUMN IF NOT EXISTS "one_time_amount" integer`,
    `CREATE TABLE IF NOT EXISTS "platform_payouts" (
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
    )`,
    `CREATE INDEX IF NOT EXISTS "platform_payouts_tenant_idx" ON "platform_payouts" ("tenant_id")`,
    `CREATE INDEX IF NOT EXISTS "platform_payouts_status_idx" ON "platform_payouts" ("status")`,
  ];

  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
    } catch (err) {
      console.warn("[ensureRuntimeSchema] skipped:", (err as Error).message?.slice(0, 120));
    }
  }

  for (const f of FEATURE_CATALOG) {
    try {
      await db.execute(sql`
        INSERT INTO "features" ("code", "name", "description", "category")
        VALUES (${f.code}, ${f.name}, ${f.description}, ${f.category})
        ON CONFLICT ("code") DO UPDATE SET
          "name" = EXCLUDED."name",
          "description" = EXCLUDED."description",
          "category" = EXCLUDED."category"
      `);
    } catch (err) {
      console.warn("[ensureRuntimeSchema] feature:", f.code, (err as Error).message?.slice(0, 80));
    }
  }

  const starterFeatures = {
    students: true,
    admissions: true,
    staff_hr: true,
    timetable: true,
    attendance: true,
    exams_results: true,
    finance_fees: true,
    messaging_enabled: true,
    portal_enabled: false,
    results_visible: true,
    fees_must_be_clear: false,
    support_standard: true,
    training_library: true,
  };
  const proFeatures = {
    ...starterFeatures,
    library: true,
    transport: true,
    portal_enabled: true,
    custom_smtp: true,
    bulk_email: true,
    mobile_app: true,
    white_label: true,
    multi_campus: true,
    ai_homework: true,
    advanced_reporting: true,
    api_access: true,
    support_extended: true,
    onboarding_training: true,
    implementation_assisted: true,
    payment_gateways: true,
    accounting_export: true,
  };
  try {
    await db.execute(sql`
      UPDATE "plans" SET "features_json" = ${JSON.stringify(starterFeatures)}::jsonb
      WHERE "code" = 'starter' AND (
        "features_json" IS NULL OR "features_json" = '{}'::jsonb
        OR NOT ("features_json" ? 'students')
      )
    `);
    await db.execute(sql`
      UPDATE "plans" SET "features_json" = ${JSON.stringify(proFeatures)}::jsonb
      WHERE "code" = 'pro' AND (
        "features_json" IS NULL OR "features_json" = '{}'::jsonb
        OR NOT ("features_json" ? 'students')
      )
    `);
  } catch (err) {
    console.warn("[ensureRuntimeSchema] plan features:", (err as Error).message?.slice(0, 120));
  }

  for (const file of [
    "0010_saas_ecosystem.sql",
    "0014_platform_support_tickets.sql",
    "0016_platform_email.sql",
    "0017_platform_backups.sql",
    "0018_platform_extras.sql",
    "0019_phase_b.sql",
    "0020_phase_ab_complete.sql",
    "0021_phase_c.sql",
    "0022_phase_d.sql",
    "0023_post_d.sql",
    "0024_remaining.sql",
    "0025_akkhor_admin.sql",
  ]) {
    await runMigrationFile(file);
  }
}
