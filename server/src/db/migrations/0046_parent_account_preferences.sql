ALTER TABLE "parent_accounts" ADD COLUMN IF NOT EXISTS "preferences_json" jsonb DEFAULT '{}'::jsonb NOT NULL;
