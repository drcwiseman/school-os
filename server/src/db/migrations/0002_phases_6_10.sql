-- Phases 6-10: academics extended, exams, finance extended, HR, payroll, operations

DO $$ BEGIN CREATE TYPE "mark_status" AS ENUM('draft', 'submitted', 'approved', 'published'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "payroll_status" AS ENUM('draft', 'pending_approval', 'approved', 'paid'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_tenant_code_idx" ON "subjects" ("tenant_id","code");

CREATE TABLE IF NOT EXISTS "rooms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "capacity" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "teacher_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "class_id" uuid NOT NULL REFERENCES "classes"("id"),
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
  "term_id" uuid REFERENCES "terms"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "timetables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "class_id" uuid NOT NULL REFERENCES "classes"("id"),
  "term_id" uuid REFERENCES "terms"("id"),
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "timetable_periods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "timetable_id" uuid NOT NULL REFERENCES "timetables"("id") ON DELETE cascade,
  "day_of_week" integer NOT NULL,
  "period_no" integer NOT NULL,
  "subject_id" uuid REFERENCES "subjects"("id"),
  "teacher_user_id" uuid REFERENCES "users"("id"),
  "room_id" uuid REFERENCES "rooms"("id"),
  "start_time" text,
  "end_time" text
);

CREATE TABLE IF NOT EXISTS "assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "class_id" uuid NOT NULL REFERENCES "classes"("id"),
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
  "title" text NOT NULL,
  "description" text,
  "due_date" timestamp,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "assignment_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "assignment_id" uuid NOT NULL REFERENCES "assignments"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id"),
  "content" text,
  "submitted_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "term_id" uuid REFERENCES "terms"("id"),
  "class_id" uuid NOT NULL REFERENCES "classes"("id"),
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
  "name" text NOT NULL,
  "type" text DEFAULT 'exam' NOT NULL,
  "weight" integer DEFAULT 100 NOT NULL,
  "max_score" integer DEFAULT 100 NOT NULL,
  "deadline" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "marks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "assessment_id" uuid NOT NULL REFERENCES "assessments"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id"),
  "score" integer,
  "status" "mark_status" DEFAULT 'draft' NOT NULL,
  "entered_by" uuid REFERENCES "users"("id"),
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "mark_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "assessment_id" uuid NOT NULL REFERENCES "assessments"("id"),
  "submitted_by" uuid REFERENCES "users"("id"),
  "submitted_at" timestamp DEFAULT now() NOT NULL,
  "locked" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "moderation_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "assessment_id" uuid NOT NULL REFERENCES "assessments"("id"),
  "mark_id" uuid REFERENCES "marks"("id"),
  "note" text NOT NULL,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "report_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id"),
  "term_id" uuid NOT NULL REFERENCES "terms"("id"),
  "data_json" jsonb DEFAULT '{}'::jsonb,
  "published" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tenant_counters" (
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "value" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "fee_structures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "term_id" uuid REFERENCES "terms"("id"),
  "class_id" uuid REFERENCES "classes"("id"),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "fee_structure_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "fee_structure_id" uuid NOT NULL REFERENCES "fee_structures"("id") ON DELETE cascade,
  "fee_head_id" uuid NOT NULL REFERENCES "fee_heads"("id"),
  "amount" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "invoice_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE cascade,
  "fee_head_id" uuid REFERENCES "fee_heads"("id"),
  "description" text NOT NULL,
  "amount" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "payment_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "payment_id" uuid NOT NULL REFERENCES "payments"("id") ON DELETE cascade,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id"),
  "amount" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "payment_id" uuid NOT NULL REFERENCES "payments"("id"),
  "receipt_no" text NOT NULL,
  "amount" integer NOT NULL,
  "issued_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "description" text NOT NULL,
  "amount" integer NOT NULL,
  "category" text,
  "spent_at" timestamp DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id")
);

CREATE TABLE IF NOT EXISTS "staff" (
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
);

CREATE TABLE IF NOT EXISTS "staff_contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
  "salary" integer NOT NULL,
  "start_date" timestamp NOT NULL,
  "end_date" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id"),
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "reason" text,
  "status" "leave_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payroll_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "period" text NOT NULL,
  "status" "payroll_status" DEFAULT 'draft' NOT NULL,
  "run_at" timestamp DEFAULT now() NOT NULL,
  "approved_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payroll_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "payroll_run_id" uuid NOT NULL REFERENCES "payroll_runs"("id") ON DELETE cascade,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id"),
  "gross_pay" integer NOT NULL,
  "deductions" integer DEFAULT 0 NOT NULL,
  "net_pay" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "payslips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "payroll_item_id" uuid NOT NULL REFERENCES "payroll_items"("id"),
  "staff_id" uuid NOT NULL REFERENCES "staff"("id"),
  "data_json" jsonb DEFAULT '{}'::jsonb,
  "issued_at" timestamp DEFAULT now() NOT NULL
);

-- Operations tables (discipline, health, library, inventory, transport, boarding) abbreviated - see schema.ts for full definitions
-- Run: npm run db:generate && npm run db:migrate if this file is incomplete for your environment
