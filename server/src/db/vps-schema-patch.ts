/**
 * Idempotent SQL patches for production DBs that never ran migrations 0019–0025.
 * Used at boot (ensureRuntimeSchema) and via `npm run db:repair`.
 */
export const VPS_SCHEMA_PATCH_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS "staff" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "user_id" uuid REFERENCES "users"("id"),
    "employee_no" text NOT NULL,
    "first_name" text NOT NULL,
    "last_name" text NOT NULL,
    "email" text,
    "department" text,
    "status" text DEFAULT 'active' NOT NULL,
    "hired_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp`,
  `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE SET NULL`,
  `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "job_title" text`,
  `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "photo_url" text`,
  `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active'`,
  `CREATE INDEX IF NOT EXISTS "staff_tenant_idx" ON "staff" ("tenant_id")`,
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
  `ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "waiting_list" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "application_fee_paid" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "interview_at" timestamp`,
  `CREATE TABLE IF NOT EXISTS "ai_usage_log" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "feature" text NOT NULL,
    "credits" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "portal_messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
    "sender_type" text NOT NULL,
    "staff_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
    "parent_account_id" uuid,
    "body" text NOT NULL,
    "read_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "portal_messages_tenant_student_idx" ON "portal_messages" ("tenant_id", "student_id")`,
  `CREATE TABLE IF NOT EXISTS "online_class_attendance" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "online_class_id" uuid NOT NULL,
    "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
    "status" text NOT NULL DEFAULT 'present',
    "joined_at" timestamp,
    "duration_minutes" integer,
    "performance_score" integer,
    "notes" text,
    "marked_by" uuid,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "school_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "title" text NOT NULL,
    "description" text,
    "event_type" text NOT NULL DEFAULT 'academic',
    "venue" text,
    "starts_at" timestamp NOT NULL,
    "ends_at" timestamp,
    "audience" text DEFAULT 'all' NOT NULL,
    "published" boolean DEFAULT true NOT NULL,
    "created_by" uuid,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "score" numeric(8,2)`,
  `ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "max_score" numeric(8,2) DEFAULT 100`,
  `ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "feedback" text`,
  `ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'submitted'`,
  `ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "graded_at" timestamp`,
  `ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "graded_by" uuid`,
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_materials') THEN
      ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "subject_id" uuid;
      ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "file_path" text;
      ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "file_name" text;
      ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "mime_type" text;
      ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "folder" text DEFAULT 'general';
    END IF;
  END $$`,
  `ALTER TABLE "online_class_links" ADD COLUMN IF NOT EXISTS "subject_id" uuid`,
  `ALTER TABLE "online_class_links" ADD COLUMN IF NOT EXISTS "attendance_session_id" uuid`,
  `ALTER TABLE "online_class_links" ADD COLUMN IF NOT EXISTS "duration_minutes" integer DEFAULT 60`,
  `ALTER TABLE "lesson_logs" ADD COLUMN IF NOT EXISTS "progress_percent" integer DEFAULT 0`,
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
