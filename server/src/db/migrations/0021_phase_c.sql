-- Phase C: Curriculum, CBT player, Finance depth

-- Curriculum
CREATE TABLE IF NOT EXISTS "curriculum_frameworks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "exam_board" text,
  "version" text DEFAULT '1.0',
  "active" boolean DEFAULT true NOT NULL,
  "settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "curriculum_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "framework_id" uuid NOT NULL REFERENCES "curriculum_frameworks"("id") ON DELETE cascade,
  "subject_id" uuid REFERENCES "subjects"("id"),
  "class_id" uuid REFERENCES "classes"("id"),
  "title" text NOT NULL,
  "order_no" integer DEFAULT 0 NOT NULL,
  "term_id" uuid REFERENCES "terms"("id")
);

CREATE TABLE IF NOT EXISTS "curriculum_competencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "framework_id" uuid NOT NULL REFERENCES "curriculum_frameworks"("id") ON DELETE cascade,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text
);

CREATE TABLE IF NOT EXISTS "curriculum_outcomes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "unit_id" uuid NOT NULL REFERENCES "curriculum_units"("id") ON DELETE cascade,
  "competency_id" uuid REFERENCES "curriculum_competencies"("id"),
  "description" text NOT NULL,
  "order_no" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "student_competency_tracking" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "competency_id" uuid NOT NULL REFERENCES "curriculum_competencies"("id") ON DELETE cascade,
  "term_id" uuid REFERENCES "terms"("id"),
  "level" text NOT NULL DEFAULT 'developing',
  "notes" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "curriculum_cross_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "from_unit_id" uuid NOT NULL REFERENCES "curriculum_units"("id") ON DELETE cascade,
  "to_unit_id" uuid NOT NULL REFERENCES "curriculum_units"("id") ON DELETE cascade,
  "note" text
);

CREATE TABLE IF NOT EXISTS "grading_scales" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "framework_id" uuid REFERENCES "curriculum_frameworks"("id"),
  "name" text NOT NULL,
  "bands_json" jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "curriculum_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "framework_code" text NOT NULL,
  "pack_json" jsonb NOT NULL,
  "imported_at" timestamp DEFAULT now() NOT NULL
);

-- Exams extensions
CREATE TABLE IF NOT EXISTS "question_banks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "subject_id" uuid REFERENCES "subjects"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "question_bank_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "bank_id" uuid NOT NULL REFERENCES "question_banks"("id") ON DELETE cascade,
  "prompt" text NOT NULL,
  "question_type" text DEFAULT 'mcq' NOT NULL,
  "options_json" jsonb DEFAULT '[]'::jsonb,
  "correct_index" integer DEFAULT 0,
  "points" integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS "grading_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "class_id" uuid REFERENCES "classes"("id"),
  "term_id" uuid REFERENCES "terms"("id"),
  "name" text NOT NULL,
  "rules_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "gpa_scale_json" jsonb
);

-- CBT extensions
ALTER TABLE "cbt_papers" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'graded';
ALTER TABLE "cbt_papers" ADD COLUMN IF NOT EXISTS "randomize" boolean DEFAULT false;
ALTER TABLE "cbt_papers" ADD COLUMN IF NOT EXISTS "lockdown" boolean DEFAULT false;
ALTER TABLE "cbt_papers" ADD COLUMN IF NOT EXISTS "published" boolean DEFAULT false;
ALTER TABLE "cbt_papers" ADD COLUMN IF NOT EXISTS "term_id" uuid REFERENCES "terms"("id");
ALTER TABLE "cbt_questions" ADD COLUMN IF NOT EXISTS "question_type" text DEFAULT 'mcq';
ALTER TABLE "cbt_questions" ADD COLUMN IF NOT EXISTS "max_words" integer;

CREATE TABLE IF NOT EXISTS "cbt_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "paper_id" uuid NOT NULL REFERENCES "cbt_papers"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "ends_at" timestamp,
  "submitted_at" timestamp,
  "ip_address" text,
  "device_fingerprint" text,
  "score" integer,
  "max_score" integer,
  "status" text DEFAULT 'in_progress' NOT NULL
);

CREATE TABLE IF NOT EXISTS "cbt_answers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "session_id" uuid NOT NULL REFERENCES "cbt_sessions"("id") ON DELETE cascade,
  "question_id" uuid NOT NULL REFERENCES "cbt_questions"("id") ON DELETE cascade,
  "answer_json" jsonb,
  "score" integer,
  "graded_at" timestamp,
  "graded_by" uuid REFERENCES "users"("id")
);

-- Finance depth
CREATE TABLE IF NOT EXISTS "installment_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE cascade,
  "installments_json" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "fee_discounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid REFERENCES "students"("id"),
  "invoice_id" uuid REFERENCES "invoices"("id"),
  "name" text NOT NULL,
  "percent" integer,
  "amount_minor" integer,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "fee_sponsorships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "sponsor_name" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "term_id" uuid REFERENCES "terms"("id"),
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "payment_id" uuid NOT NULL REFERENCES "payments"("id"),
  "amount_minor" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "reason" text,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "chart_of_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "account_type" text NOT NULL DEFAULT 'asset',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "journal_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "entry_date" date NOT NULL,
  "description" text NOT NULL,
  "reference" text,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "journal_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "entry_id" uuid NOT NULL REFERENCES "journal_entries"("id") ON DELETE cascade,
  "account_id" uuid NOT NULL REFERENCES "chart_of_accounts"("id"),
  "debit_minor" integer DEFAULT 0 NOT NULL,
  "credit_minor" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "budgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "fiscal_year" integer NOT NULL,
  "category" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "spent_minor" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "curriculum_framework" text;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "late_penalty_percent" integer DEFAULT 0;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "payment_providers_json" jsonb DEFAULT '{}'::jsonb;
