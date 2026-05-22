import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/school_os",
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "admission_forms" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "admission_forms_tenant_idx" ON "admission_forms" ("tenant_id");

      CREATE TABLE IF NOT EXISTS "admission_form_fields" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "form_id" uuid NOT NULL REFERENCES "admission_forms"("id") ON DELETE CASCADE,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "field_name" text NOT NULL,
        "field_key" text NOT NULL,
        "field_type" text NOT NULL DEFAULT 'text',
        "options_json" jsonb,
        "is_required" boolean NOT NULL DEFAULT false,
        "order_idx" integer NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS "admission_form_fields_form_idx" ON "admission_form_fields" ("form_id");

      ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "form_id" uuid REFERENCES "admission_forms"("id");
      ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "custom_fields" jsonb DEFAULT '{}'::jsonb;
      CREATE INDEX IF NOT EXISTS "applicants_form_idx" ON "applicants" ("form_id");
    `);
    console.log("Migration executed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
