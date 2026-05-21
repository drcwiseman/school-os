-- Administration: setup wizard progress, appearance presets

ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "setup_wizard_json" jsonb DEFAULT '{}'::jsonb;
