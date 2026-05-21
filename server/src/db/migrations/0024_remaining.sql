ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "biometric_id" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "medical_json" jsonb DEFAULT '{}'::jsonb;

ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "waiting_list" boolean DEFAULT false NOT NULL;
ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "application_fee_paid" boolean DEFAULT false NOT NULL;
ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "interview_at" timestamp;

ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "theme_json" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "sidebar_order_json" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "admission_workflow_json" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "onboarding_checklist_json" jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "tenant_help_articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "body_md" text NOT NULL DEFAULT '',
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payroll_tax_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "rate_percent" integer NOT NULL DEFAULT 0,
  "threshold_minor" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "job_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "department" text,
  "description" text DEFAULT '' NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "job_applicants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "job_post_id" uuid NOT NULL REFERENCES "job_posts"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "status" text NOT NULL DEFAULT 'applied',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "library_ebooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "author" text,
  "url" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "library_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "book_id" uuid REFERENCES "library_books"("id") ON DELETE SET NULL,
  "ebook_id" uuid REFERENCES "library_ebooks"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "student_materials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "subject" text,
  "url" text,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "online_class_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "url" text NOT NULL,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "scheduled_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "exam_external_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "assessment_id" uuid NOT NULL,
  "token" text NOT NULL UNIQUE,
  "examiner_email" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "cbt_proctor_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "session_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "detail" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "staff_disciplinary" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
  "incident_date" timestamp DEFAULT now() NOT NULL,
  "description" text NOT NULL,
  "action" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "staff_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
  "document_type" text NOT NULL,
  "file_name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "staff_benefits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "amount_minor" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "performance_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
  "period" text NOT NULL,
  "score" integer,
  "comments" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
