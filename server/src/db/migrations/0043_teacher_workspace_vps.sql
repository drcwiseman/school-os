-- Teacher workspace tables (Phase B) for VPS DBs that never ran 0019+

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

CREATE TABLE IF NOT EXISTS "teacher_meetings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "scheduled_at" timestamp NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "timetable_periods" ADD COLUMN IF NOT EXISTS "teacher_user_id" uuid REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "timetable_periods" ADD COLUMN IF NOT EXISTS "start_time" text;
ALTER TABLE "timetable_periods" ADD COLUMN IF NOT EXISTS "end_time" text;
