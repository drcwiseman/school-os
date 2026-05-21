-- Staff & HR: attendance by staff, ID card fields, payroll deduction breakdown

ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "staff_id" uuid REFERENCES "staff"("id") ON DELETE cascade;
ALTER TABLE "staff_attendance" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "job_title" text;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "photo_url" text;
ALTER TABLE "payroll_items" ADD COLUMN IF NOT EXISTS "deductions_json" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "staff_attendance" ADD COLUMN IF NOT EXISTS "notes" text;

CREATE INDEX IF NOT EXISTS "staff_attendance_staff_date_idx" ON "staff_attendance" ("tenant_id", "staff_id", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "staff_attendance_tenant_staff_date_uq"
  ON "staff_attendance" ("tenant_id", "staff_id", "date")
  WHERE "staff_id" IS NOT NULL;
