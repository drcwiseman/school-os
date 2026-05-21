-- Fee & Accounting: fee types, concessions, donations, auto-invoice schedules

ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "fee_type" text NOT NULL DEFAULT 'other';

CREATE TABLE IF NOT EXISTS "fee_concession_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "category" text NOT NULL DEFAULT 'scholarship',
  "percent" integer,
  "amount_minor" integer,
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "student_fee_concessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "policy_id" uuid REFERENCES "fee_concession_policies"("id") ON DELETE set null,
  "term_id" uuid REFERENCES "terms"("id") ON DELETE set null,
  "percent" integer,
  "amount_minor" integer,
  "reason" text,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "donations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "donor_name" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "purpose" text,
  "payment_method" text DEFAULT 'cash',
  "reference" text,
  "received_at" timestamp DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "donations_tenant_idx" ON "donations" ("tenant_id");

CREATE TABLE IF NOT EXISTS "recurring_fee_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "fee_structure_id" uuid NOT NULL REFERENCES "fee_structures"("id") ON DELETE cascade,
  "term_id" uuid REFERENCES "terms"("id") ON DELETE set null,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE set null,
  "frequency" text NOT NULL DEFAULT 'term',
  "due_days_after" integer NOT NULL DEFAULT 14,
  "enabled" boolean NOT NULL DEFAULT true,
  "last_run_at" timestamp,
  "next_run_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "fee_structures" ADD COLUMN IF NOT EXISTS "auto_generate" boolean NOT NULL DEFAULT false;
