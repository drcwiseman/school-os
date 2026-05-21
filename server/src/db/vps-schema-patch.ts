/**
 * Idempotent SQL patches for production DBs that never ran migrations 0019–0025.
 * Used at boot (ensureRuntimeSchema) and via `npm run db:repair`.
 */
export const VPS_SCHEMA_PATCH_SQL: string[] = [
  `ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "publish_at" timestamp`,
  `ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp`,
  `ALTER TABLE "platform_backups" ADD COLUMN IF NOT EXISTS "offsite_key" text`,
  `ALTER TABLE "platform_backups" ADD COLUMN IF NOT EXISTS "offsite_status" text`,
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
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "smtp_settings_json" jsonb NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "communications_json" jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "curriculum_framework" text`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "late_penalty_percent" integer DEFAULT 0`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "payment_providers_json" jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "security_json" jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "branding_extended_json" jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "theme_json" jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "sidebar_order_json" jsonb DEFAULT '[]'::jsonb`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "admission_workflow_json" jsonb DEFAULT '[]'::jsonb`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "onboarding_checklist_json" jsonb DEFAULT '[]'::jsonb`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "biometric_id" text`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "medical_json" jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "blood_group" text`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "phone" text`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "email" text`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "address" text`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "short_bio" text`,
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
];

export async function applyVpsSchemaPatch(run: (sql: string) => Promise<void>) {
  for (const stmt of VPS_SCHEMA_PATCH_SQL) {
    await run(stmt);
  }
}
