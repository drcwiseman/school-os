-- Phase B: teacher workspace, portal messaging, communications settings

CREATE TABLE IF NOT EXISTS "lesson_plans" (
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
);
CREATE INDEX IF NOT EXISTS "lesson_plans_tenant_idx" ON "lesson_plans" ("tenant_id");

CREATE TABLE IF NOT EXISTS "scheme_of_work" (
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
);
CREATE INDEX IF NOT EXISTS "scheme_of_work_tenant_idx" ON "scheme_of_work" ("tenant_id");

CREATE TABLE IF NOT EXISTS "teacher_meetings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "scheduled_at" timestamp NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "teacher_meetings_tenant_idx" ON "teacher_meetings" ("tenant_id");

CREATE TABLE IF NOT EXISTS "portal_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "sender_type" text NOT NULL,
  "staff_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "parent_account_id" uuid REFERENCES "parent_accounts"("id") ON DELETE set null,
  "body" text NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "portal_messages_tenant_student_idx" ON "portal_messages" ("tenant_id", "student_id");

ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "communications_json" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "channel" text NOT NULL DEFAULT 'sms';
