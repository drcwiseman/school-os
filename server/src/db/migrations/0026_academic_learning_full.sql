-- Academic & Learning: live class attendance, materials upload, homework grades, school events, lesson progress

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
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "online_class_attendance_unique" UNIQUE("online_class_id","student_id")
);

CREATE INDEX IF NOT EXISTS "online_class_attendance_tenant_idx" ON "online_class_attendance" ("tenant_id");

ALTER TABLE "online_class_links" ADD COLUMN IF NOT EXISTS "subject_id" uuid REFERENCES "subjects"("id") ON DELETE set null;
ALTER TABLE "online_class_links" ADD COLUMN IF NOT EXISTS "attendance_session_id" uuid REFERENCES "attendance_sessions"("id") ON DELETE set null;
ALTER TABLE "online_class_links" ADD COLUMN IF NOT EXISTS "duration_minutes" integer DEFAULT 60;

ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "subject_id" uuid REFERENCES "subjects"("id") ON DELETE set null;
ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "file_path" text;
ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "file_name" text;
ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "mime_type" text;
ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "folder" text DEFAULT 'general';

ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "score" numeric(8,2);
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "max_score" numeric(8,2) DEFAULT 100;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "feedback" text;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'submitted';
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "graded_at" timestamp;
ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "graded_by" uuid REFERENCES "users"("id") ON DELETE set null;

CREATE TABLE IF NOT EXISTS "school_events" (
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
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "school_events_tenant_starts_idx" ON "school_events" ("tenant_id", "starts_at");

ALTER TABLE "lesson_logs" ADD COLUMN IF NOT EXISTS "progress_percent" integer DEFAULT 0;
