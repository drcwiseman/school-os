-- Examination & Assessment: groups, timetable, multi-groups, admit cards, result metadata

CREATE TABLE IF NOT EXISTS "exam_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "group_type" text NOT NULL DEFAULT 'term',
  "term_id" uuid REFERENCES "terms"("id") ON DELETE set null,
  "description" text,
  "published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "exam_groups_tenant_idx" ON "exam_groups" ("tenant_id");

CREATE TABLE IF NOT EXISTS "exam_academic_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "exam_academic_group_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "group_id" uuid NOT NULL REFERENCES "exam_academic_groups"("id") ON DELETE cascade,
  "member_type" text NOT NULL,
  "member_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "exam_academic_group_members_group_idx" ON "exam_academic_group_members" ("group_id");

CREATE TABLE IF NOT EXISTS "exam_timetable_slots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "exam_group_id" uuid REFERENCES "exam_groups"("id") ON DELETE set null,
  "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE cascade,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE cascade,
  "assessment_id" uuid REFERENCES "assessments"("id") ON DELETE set null,
  "exam_date" timestamp NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "room" text,
  "published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "exam_timetable_tenant_idx" ON "exam_timetable_slots" ("tenant_id");

CREATE TABLE IF NOT EXISTS "exam_admit_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "exam_group_id" uuid NOT NULL REFERENCES "exam_groups"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "hall" text,
  "seat_no" text,
  "issued_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("exam_group_id", "student_id")
);

ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "exam_group_id" uuid REFERENCES "exam_groups"("id") ON DELETE set null;
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "session_label" text;
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "published" boolean NOT NULL DEFAULT false;

ALTER TABLE "marks" ADD COLUMN IF NOT EXISTS "grade" text;
ALTER TABLE "marks" ADD COLUMN IF NOT EXISTS "remarks" text;
