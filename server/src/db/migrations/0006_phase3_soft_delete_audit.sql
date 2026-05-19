-- Soft delete: exam marks & payroll
ALTER TABLE "marks" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "marks" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE set null;

ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE set null;

ALTER TABLE "payroll_items" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "payroll_items" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE set null;

-- Audit logs: append-only (no UPDATE / DELETE)
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are append-only and cannot be modified';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_update ON "audit_logs";
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE PROCEDURE prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON "audit_logs";
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE PROCEDURE prevent_audit_log_mutation();
