-- Extended account lifecycle — each ALTER TYPE must commit separately (PG10/CWP).
-- Drizzle runs statements between breakpoints in their own transaction.
ALTER TYPE "user_status" ADD VALUE 'suspended';
--> statement-breakpoint
ALTER TYPE "user_status" ADD VALUE 'disabled';
--> statement-breakpoint
ALTER TYPE "user_status" ADD VALUE 'pending';
--> statement-breakpoint
-- Portal: separate parent vs student identity (ownership-based access, not staff RBAC)
CREATE TABLE IF NOT EXISTS "parent_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "guardian_id" uuid NOT NULL REFERENCES "guardians"("id") ON DELETE cascade,
  "status" "user_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "parent_accounts_tenant_email_unique" UNIQUE("tenant_id","email")
);

CREATE TABLE IF NOT EXISTS "student_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
  "status" "user_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "student_accounts_tenant_email_unique" UNIQUE("tenant_id","email")
);

CREATE INDEX IF NOT EXISTS "parent_accounts_tenant_idx" ON "parent_accounts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "student_accounts_tenant_idx" ON "student_accounts" ("tenant_id");

CREATE TABLE IF NOT EXISTS "parent_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parent_account_id" uuid NOT NULL REFERENCES "parent_accounts"("id") ON DELETE cascade,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "token" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "parent_sessions_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS "student_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_account_id" uuid NOT NULL REFERENCES "student_accounts"("id") ON DELETE cascade,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "token" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "student_sessions_token_unique" UNIQUE("token")
);

CREATE UNIQUE INDEX IF NOT EXISTS "parent_sessions_token_idx" ON "parent_sessions" ("token");
CREATE UNIQUE INDEX IF NOT EXISTS "student_sessions_token_idx" ON "student_sessions" ("token");

-- Migrate from legacy portal_accounts (if upgrading from pre-0005 schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_accounts') THEN
    INSERT INTO "parent_accounts" ("id", "tenant_id", "email", "password_hash", "guardian_id", "status", "created_at", "updated_at")
    SELECT "id", "tenant_id", "email", "password_hash", "guardian_id", "status", "created_at", "created_at"
    FROM "portal_accounts"
    WHERE "type" = 'parent' AND "guardian_id" IS NOT NULL
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "student_accounts" ("id", "tenant_id", "email", "password_hash", "student_id", "status", "created_at", "updated_at")
    SELECT "id", "tenant_id", "email", "password_hash", "student_id", "status", "created_at", "created_at"
    FROM "portal_accounts"
    WHERE "type" = 'student' AND "student_id" IS NOT NULL
    ON CONFLICT ("id") DO NOTHING;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_sessions') THEN
      INSERT INTO "parent_sessions" ("id", "parent_account_id", "tenant_id", "token", "expires_at", "created_at")
      SELECT ps."id", ps."portal_account_id", ps."tenant_id", ps."token", ps."expires_at", ps."created_at"
      FROM "portal_sessions" ps
      INNER JOIN "portal_accounts" pa ON pa."id" = ps."portal_account_id" AND pa."type" = 'parent'
      ON CONFLICT ("id") DO NOTHING;

      INSERT INTO "student_sessions" ("id", "student_account_id", "tenant_id", "token", "expires_at", "created_at")
      SELECT ps."id", ps."portal_account_id", ps."tenant_id", ps."token", ps."expires_at", ps."created_at"
      FROM "portal_sessions" ps
      INNER JOIN "portal_accounts" pa ON pa."id" = ps."portal_account_id" AND pa."type" = 'student'
      ON CONFLICT ("id") DO NOTHING;

      DROP TABLE "portal_sessions";
    END IF;
    DROP TABLE "portal_accounts";
  END IF;
END $$;
