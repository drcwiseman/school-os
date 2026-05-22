-- HR tables often missing on VPS DBs that only ran partial migrations.

DO $$ BEGIN
  CREATE TYPE "leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "staff_contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
  "salary" integer NOT NULL,
  "start_date" timestamp NOT NULL,
  "end_date" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "staff_contracts_tenant_idx" ON "staff_contracts" ("tenant_id");

CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id"),
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "reason" text,
  "status" "leave_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "leave_requests_tenant_idx" ON "leave_requests" ("tenant_id");

CREATE TABLE IF NOT EXISTS "staff_attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "staff_id" uuid REFERENCES "staff"("id") ON DELETE cascade,
  "user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
  "date" text NOT NULL,
  "status" text NOT NULL DEFAULT 'present',
  "checked_in_at" timestamp DEFAULT now() NOT NULL,
  "notes" text
);
ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "staff_id" uuid REFERENCES "staff"("id") ON DELETE cascade;
ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "notes" text;
DO $$ BEGIN
  ALTER TABLE "staff_attendance" ALTER COLUMN "user_id" DROP NOT NULL;
EXCEPTION WHEN others THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "staff_attendance_staff_date_idx" ON "staff_attendance" ("tenant_id", "staff_id", "date");
