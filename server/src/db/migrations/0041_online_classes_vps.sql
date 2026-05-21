CREATE TABLE IF NOT EXISTS "online_class_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "url" text NOT NULL,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "scheduled_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "online_class_links" ADD COLUMN IF NOT EXISTS "subject_id" uuid REFERENCES "subjects"("id") ON DELETE set null;
ALTER TABLE "online_class_links" ADD COLUMN IF NOT EXISTS "attendance_session_id" uuid REFERENCES "attendance_sessions"("id") ON DELETE set null;
ALTER TABLE "online_class_links" ADD COLUMN IF NOT EXISTS "duration_minutes" integer DEFAULT 60;

CREATE TABLE IF NOT EXISTS "online_class_attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "online_class_id" uuid NOT NULL REFERENCES "online_class_links"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "status" text NOT NULL DEFAULT 'present',
  "joined_at" timestamp,
  "duration_minutes" integer,
  "performance_score" integer,
  "notes" text,
  "marked_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "online_class_attendance_unique" ON "online_class_attendance" ("online_class_id", "student_id");
