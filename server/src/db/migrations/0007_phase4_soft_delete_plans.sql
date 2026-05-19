-- Soft delete: assessments, fee structures, staff
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE set null;

ALTER TABLE "fee_structures" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "fee_structures" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE set null;

ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE set null;

-- Align plan feature keys with features.code catalog (starter = portal off)
UPDATE "plans" SET "features_json" = '{"messaging_enabled":true,"portal_enabled":false,"results_visible":true,"fees_must_be_clear":false}'::jsonb WHERE "code" = 'starter';
UPDATE "plans" SET "features_json" = '{"messaging_enabled":true,"portal_enabled":true,"results_visible":true,"fees_must_be_clear":false}'::jsonb WHERE "code" = 'pro';
