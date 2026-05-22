-- Payroll tables for VPS DBs missing phase 9 migrations.

DO $$ BEGIN
  CREATE TYPE "payroll_status" AS ENUM('draft', 'pending_approval', 'approved', 'paid');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "payroll_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "period" text NOT NULL,
  "status" "payroll_status" DEFAULT 'draft' NOT NULL,
  "run_at" timestamp DEFAULT now() NOT NULL,
  "approved_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "payroll_runs_tenant_idx" ON "payroll_runs" ("tenant_id");

CREATE TABLE IF NOT EXISTS "payroll_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "payroll_run_id" uuid NOT NULL REFERENCES "payroll_runs"("id") ON DELETE cascade,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id"),
  "gross_pay" integer NOT NULL,
  "deductions" integer DEFAULT 0 NOT NULL,
  "net_pay" integer NOT NULL
);
ALTER TABLE "payroll_items" ADD COLUMN IF NOT EXISTS "deductions_json" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "payroll_items" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "payroll_items" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "payroll_items_tenant_idx" ON "payroll_items" ("tenant_id");

CREATE TABLE IF NOT EXISTS "payslips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "payroll_item_id" uuid NOT NULL REFERENCES "payroll_items"("id"),
  "staff_id" uuid NOT NULL REFERENCES "staff"("id"),
  "data_json" jsonb DEFAULT '{}'::jsonb,
  "issued_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "payslips_tenant_idx" ON "payslips" ("tenant_id");

CREATE TABLE IF NOT EXISTS "payroll_tax_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "rate_percent" integer DEFAULT 0 NOT NULL,
  "threshold_minor" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
