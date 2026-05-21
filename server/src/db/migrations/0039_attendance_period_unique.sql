-- Allow multiple sessions per class/day when period_no differs
ALTER TABLE "attendance_sessions" ADD COLUMN IF NOT EXISTS "period_no" integer;

DROP INDEX IF EXISTS "att_sessions_class_date_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "att_sessions_class_date_period_idx"
  ON "attendance_sessions" ("tenant_id", "class_id", ("date"::date), COALESCE("period_no", 0));
