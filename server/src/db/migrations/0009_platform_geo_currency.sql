ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "country" text NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL DEFAULT '{}',
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "platform_settings" ("key", "value") VALUES ('defaults', '{"displayCurrency":"USD"}')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plan_regional_prices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL REFERENCES "plans"("id") ON DELETE cascade,
  "country_code" text NOT NULL DEFAULT '*',
  "currency" text NOT NULL,
  "price_monthly" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "plan_regional_prices_plan_country_currency_unique" UNIQUE("plan_id","country_code","currency")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plan_regional_prices_plan_idx" ON "plan_regional_prices" ("plan_id");
