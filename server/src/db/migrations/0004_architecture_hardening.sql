-- Platform admin role (optional metadata; auth remains platform_admins + platform_sessions only)
ALTER TABLE "platform_admins" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'super_admin';

-- Relational feature flags
CREATE TABLE IF NOT EXISTS "features" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "features_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "tenant_features" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "feature_id" uuid NOT NULL REFERENCES "features"("id") ON DELETE cascade,
  "enabled" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_features_tenant_feature_unique" UNIQUE("tenant_id","feature_id")
);

CREATE INDEX IF NOT EXISTS "tenant_features_tenant_idx" ON "tenant_features" ("tenant_id");

INSERT INTO "features" ("code", "name", "description") VALUES
  ('results_visible', 'Results visible to portal', 'Parents/students can see published results when other rules pass'),
  ('fees_must_be_clear', 'Fees must be clear', 'Block portal results until invoices are paid'),
  ('portal_enabled', 'Parent/student portal', 'Enable portal logins for this school'),
  ('messaging_enabled', 'Messaging module', 'SMS/email campaigns and announcements')
ON CONFLICT ("code") DO NOTHING;

-- Soft delete columns (staff + finance + students)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE set null;

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE set null;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE set null;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE set null;

-- Portal account integrity (legacy portal_accounts only; skip if already on parent_accounts)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_accounts') THEN
    ALTER TABLE "portal_accounts" DROP CONSTRAINT IF EXISTS "portal_accounts_type_link_check";
    ALTER TABLE "portal_accounts" ADD CONSTRAINT "portal_accounts_type_link_check" CHECK (
      (type = 'parent' AND guardian_id IS NOT NULL AND student_id IS NULL)
      OR (type = 'student' AND student_id IS NOT NULL AND guardian_id IS NULL)
    );
  END IF;
END $$;
