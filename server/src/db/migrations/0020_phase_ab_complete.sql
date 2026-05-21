-- Complete Phase A & B scope (classroom, library, teacher, comms)

ALTER TABLE "teacher_assignments" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'subject';
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "class_teacher_user_id" uuid REFERENCES "users"("id") ON DELETE set null;
ALTER TABLE "attendance_sessions" ADD COLUMN IF NOT EXISTS "period_no" integer;

CREATE TABLE IF NOT EXISTS "seating_layouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "stream_id" uuid NOT NULL REFERENCES "streams"("id") ON DELETE cascade,
  "rows" integer NOT NULL DEFAULT 5,
  "cols" integer NOT NULL DEFAULT 6,
  "seats_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lesson_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "class_id" uuid NOT NULL REFERENCES "classes"("id"),
  "subject_id" uuid REFERENCES "subjects"("id"),
  "user_id" uuid REFERENCES "users"("id"),
  "log_date" timestamp NOT NULL DEFAULT now(),
  "topic" text NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "smart_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "room_id" uuid REFERENCES "rooms"("id"),
  "name" text NOT NULL,
  "device_type" text NOT NULL DEFAULT 'smartboard',
  "serial_no" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "staff_attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "date" text NOT NULL,
  "status" text NOT NULL DEFAULT 'present',
  "checked_in_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "staff_attendance_unique" UNIQUE("tenant_id","user_id","date")
);

CREATE TABLE IF NOT EXISTS "substitute_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "absent_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "substitute_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "class_id" uuid REFERENCES "classes"("id"),
  "date" text NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "internal_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "from_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "to_user_id" uuid REFERENCES "users"("id"),
  "body" text NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "cbt_papers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "class_id" uuid REFERENCES "classes"("id"),
  "subject_id" uuid REFERENCES "subjects"("id"),
  "duration_minutes" integer NOT NULL DEFAULT 60,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "cbt_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "paper_id" uuid NOT NULL REFERENCES "cbt_papers"("id") ON DELETE cascade,
  "prompt" text NOT NULL,
  "options_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "correct_index" integer NOT NULL DEFAULT 0,
  "points" integer NOT NULL DEFAULT 1,
  "order_no" integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "lesson_logs_tenant_idx" ON "lesson_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "staff_attendance_tenant_date_idx" ON "staff_attendance" ("tenant_id", "date");
CREATE INDEX IF NOT EXISTS "internal_messages_tenant_idx" ON "internal_messages" ("tenant_id");
