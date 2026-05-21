ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "campus_id" uuid;

CREATE TABLE IF NOT EXISTS "student_materials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "subject" text,
  "url" text,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "subject_id" uuid REFERENCES "subjects"("id") ON DELETE set null;
ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "file_path" text;
ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "file_name" text;
ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "mime_type" text;
ALTER TABLE "student_materials" ADD COLUMN IF NOT EXISTS "folder" text DEFAULT 'general';

ALTER TABLE "lesson_logs" ADD COLUMN IF NOT EXISTS "progress_percent" integer DEFAULT 0;
