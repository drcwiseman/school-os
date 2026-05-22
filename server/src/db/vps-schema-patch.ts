/**
 * Idempotent SQL patches for production DBs that never ran migrations 0019–0025.
 * Used at boot (ensureRuntimeSchema) and via `npm run db:repair`.
 */
import { FACILITIES_BASE_TABLES_SQL } from "./facilities-base-sql";
import { FACILITIES_OPERATIONS_SQL } from "./facilities-operations-sql";
import { OPERATIONS_BASE_TABLES_SQL } from "./operations-base-sql";
import { MESSAGING_BASE_TABLES_SQL } from "./messaging-base-sql";

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
  `ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "campus_id" uuid`,
  `CREATE TABLE IF NOT EXISTS "student_materials" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "title" text NOT NULL,
    "subject" text,
    "url" text,
    "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "subject_id" uuid`,
  `ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "file_path" text`,
  `ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "file_name" text`,
  `ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "mime_type" text`,
  `ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "folder" text DEFAULT 'general'`,
  `ALTER TABLE "lesson_logs" ADD COLUMN IF NOT EXISTS "progress_percent" integer DEFAULT 0`,
  `ALTER TABLE "attendance_sessions" ADD COLUMN IF NOT EXISTS "period_no" integer`,
  `DROP INDEX IF EXISTS "att_sessions_class_date_idx"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "att_sessions_class_date_period_idx" ON "attendance_sessions" ("tenant_id", "class_id", (("date")::date), COALESCE("period_no", 0))`,
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
  ...FACILITIES_BASE_TABLES_SQL,
  ...FACILITIES_OPERATIONS_SQL,
  ...OPERATIONS_BASE_TABLES_SQL,
  ...MESSAGING_BASE_TABLES_SQL,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "campus_id" uuid REFERENCES "tenant_campuses"("id") ON DELETE SET NULL`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret" text`,
  `ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "campus_id" uuid REFERENCES "tenant_campuses"("id") ON DELETE SET NULL`,
  `ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "campus_id" uuid REFERENCES "tenant_campuses"("id") ON DELETE SET NULL`,
  `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "campus_id" uuid REFERENCES "tenant_campuses"("id") ON DELETE SET NULL`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "smtp_settings_json" jsonb NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "communications_json" jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "curriculum_framework" text`,
  `CREATE TABLE IF NOT EXISTS "curriculum_frameworks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "code" text NOT NULL,
    "name" text NOT NULL,
    "exam_board" text,
    "version" text DEFAULT '1.0',
    "active" boolean DEFAULT true NOT NULL,
    "settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "curriculum_units" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "framework_id" uuid NOT NULL REFERENCES "curriculum_frameworks"("id") ON DELETE cascade,
    "subject_id" uuid REFERENCES "subjects"("id"),
    "class_id" uuid REFERENCES "classes"("id"),
    "title" text NOT NULL,
    "order_no" integer DEFAULT 0 NOT NULL,
    "term_id" uuid REFERENCES "terms"("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "curriculum_competencies" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "framework_id" uuid NOT NULL REFERENCES "curriculum_frameworks"("id") ON DELETE cascade,
    "code" text NOT NULL,
    "name" text NOT NULL,
    "description" text
  )`,
  `CREATE TABLE IF NOT EXISTS "curriculum_outcomes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "unit_id" uuid NOT NULL REFERENCES "curriculum_units"("id") ON DELETE cascade,
    "competency_id" uuid REFERENCES "curriculum_competencies"("id"),
    "description" text NOT NULL,
    "order_no" integer DEFAULT 0 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "student_competency_tracking" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
    "competency_id" uuid NOT NULL REFERENCES "curriculum_competencies"("id") ON DELETE cascade,
    "term_id" uuid REFERENCES "terms"("id"),
    "level" text NOT NULL DEFAULT 'developing',
    "notes" text,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "curriculum_cross_links" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "from_unit_id" uuid NOT NULL REFERENCES "curriculum_units"("id") ON DELETE cascade,
    "to_unit_id" uuid NOT NULL REFERENCES "curriculum_units"("id") ON DELETE cascade,
    "note" text
  )`,
  `CREATE TABLE IF NOT EXISTS "grading_scales" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "framework_id" uuid REFERENCES "curriculum_frameworks"("id"),
    "name" text NOT NULL,
    "bands_json" jsonb DEFAULT '[]'::jsonb NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "curriculum_packs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "name" text NOT NULL,
    "framework_code" text NOT NULL,
    "pack_json" jsonb NOT NULL,
    "imported_at" timestamp DEFAULT now() NOT NULL
  )`,
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
  `CREATE TABLE IF NOT EXISTS "online_class_links" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "title" text NOT NULL,
    "url" text NOT NULL,
    "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
    "scheduled_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `ALTER TABLE "online_class_links" ADD COLUMN IF NOT EXISTS "subject_id" uuid`,
  `ALTER TABLE "online_class_links" ADD COLUMN IF NOT EXISTS "attendance_session_id" uuid`,
  `ALTER TABLE "online_class_links" ADD COLUMN IF NOT EXISTS "duration_minutes" integer DEFAULT 60`,
  `ALTER TABLE "lesson_logs" ADD COLUMN IF NOT EXISTS "progress_percent" integer DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS "lesson_plans" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
    "class_id" uuid REFERENCES "classes"("id") ON DELETE set null,
    "subject_id" uuid REFERENCES "subjects"("id") ON DELETE set null,
    "title" text NOT NULL,
    "content" text NOT NULL DEFAULT '',
    "week_no" integer,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "scheme_of_work" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
    "class_id" uuid REFERENCES "classes"("id") ON DELETE set null,
    "subject_id" uuid REFERENCES "subjects"("id") ON DELETE set null,
    "term_id" uuid REFERENCES "terms"("id") ON DELETE set null,
    "week_no" integer NOT NULL DEFAULT 1,
    "topic" text NOT NULL,
    "objectives" text,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "teacher_meetings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
    "title" text NOT NULL,
    "scheduled_at" timestamp NOT NULL,
    "notes" text,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `ALTER TABLE "timetable_periods" ADD COLUMN IF NOT EXISTS "teacher_user_id" uuid REFERENCES "users"("id") ON DELETE set null`,
  `ALTER TABLE "timetable_periods" ADD COLUMN IF NOT EXISTS "start_time" text`,
  `ALTER TABLE "timetable_periods" ADD COLUMN IF NOT EXISTS "end_time" text`,
  `DO $$ BEGIN CREATE TYPE "leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `CREATE TABLE IF NOT EXISTS "staff_contracts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
    "salary" integer NOT NULL,
    "start_date" timestamp NOT NULL,
    "end_date" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "staff_contracts_tenant_idx" ON "staff_contracts" ("tenant_id")`,
  `CREATE TABLE IF NOT EXISTS "leave_requests" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "staff_id" uuid NOT NULL REFERENCES "staff"("id"),
    "start_date" timestamp NOT NULL,
    "end_date" timestamp NOT NULL,
    "reason" text,
    "status" "leave_status" DEFAULT 'pending' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "leave_requests_tenant_idx" ON "leave_requests" ("tenant_id")`,
  `CREATE TABLE IF NOT EXISTS "staff_attendance" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "staff_id" uuid REFERENCES "staff"("id") ON DELETE cascade,
    "user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
    "date" text NOT NULL,
    "status" text NOT NULL DEFAULT 'present',
    "checked_in_at" timestamp DEFAULT now() NOT NULL,
    "notes" text
  )`,
  `ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "staff_id" uuid REFERENCES "staff"("id") ON DELETE cascade`,
  `ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "notes" text`,
  `CREATE INDEX IF NOT EXISTS "staff_attendance_staff_date_idx" ON "staff_attendance" ("tenant_id", "staff_id", "date")`,
  `DO $$ BEGIN CREATE TYPE "payroll_status" AS ENUM('draft', 'pending_approval', 'approved', 'paid'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `CREATE TABLE IF NOT EXISTS "payroll_runs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "period" text NOT NULL,
    "status" "payroll_status" DEFAULT 'draft' NOT NULL,
    "run_at" timestamp DEFAULT now() NOT NULL,
    "approved_by" uuid REFERENCES "users"("id"),
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
  `ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp`,
  `ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS "payroll_runs_tenant_idx" ON "payroll_runs" ("tenant_id")`,
  `CREATE TABLE IF NOT EXISTS "payroll_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "payroll_run_id" uuid NOT NULL REFERENCES "payroll_runs"("id") ON DELETE cascade,
    "staff_id" uuid NOT NULL REFERENCES "staff"("id"),
    "gross_pay" integer NOT NULL,
    "deductions" integer DEFAULT 0 NOT NULL,
    "net_pay" integer NOT NULL
  )`,
  `ALTER TABLE "payroll_items" ADD COLUMN IF NOT EXISTS "deductions_json" jsonb DEFAULT '{}'::jsonb`,
  `ALTER TABLE "payroll_items" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp`,
  `ALTER TABLE "payroll_items" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS "payroll_items_tenant_idx" ON "payroll_items" ("tenant_id")`,
  `CREATE TABLE IF NOT EXISTS "payslips" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "payroll_item_id" uuid NOT NULL REFERENCES "payroll_items"("id"),
    "staff_id" uuid NOT NULL REFERENCES "staff"("id"),
    "data_json" jsonb DEFAULT '{}'::jsonb,
    "issued_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "payslips_tenant_idx" ON "payslips" ("tenant_id")`,
  `CREATE TABLE IF NOT EXISTS "payroll_tax_rules" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
    "name" text NOT NULL,
    "rate_percent" integer DEFAULT 0 NOT NULL,
    "threshold_minor" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`,
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
