-- Curriculum module tables (Phase C) for VPS DBs that never ran 0021+

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

ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "curriculum_framework" text;
