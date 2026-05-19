/**
 * One-off repair for VPS DBs where migrations 0004+ stalled (enum-in-transaction / missing columns).
 * Each statement auto-commits. Safe to re-run.
 *
 *   npm run db:repair --prefix server
 *   npm run db:ensure-platform --prefix server
 *   npm run db:seed --prefix server
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function run(statement: string) {
  const label = statement.replace(/\s+/g, " ").trim().slice(0, 90);
  console.log(`→ ${label}`);
  await db.execute(sql.raw(statement));
}

async function addEnumValue(typeName: string, label: string) {
  try {
    await run(`ALTER TYPE "${typeName}" ADD VALUE '${label}'`);
    console.log(`  ✓ ${typeName}.${label}`);
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "42710" || e.message?.includes("already exists")) {
      console.log(`  · ${typeName}.${label} already present`);
      return;
    }
    throw err;
  }
}

async function main() {
  console.log("Repairing schema (idempotent)…\n");

  await run(
    `ALTER TABLE "platform_admins" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'super_admin'`,
  );

  await addEnumValue("user_status", "suspended");
  await addEnumValue("user_status", "disabled");
  await addEnumValue("user_status", "pending");

  await run(`ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "publish_at" timestamp`);

  console.log("\n✅ Repair SQL applied.");
  console.log("Next on the server:");
  console.log("  npm run db:migrate");
  console.log("  npm run db:ensure-platform");
  console.log("  npm run db:seed");
  console.log("  pm2 restart school-os --update-env");
  process.exit(0);
}

main().catch((err) => {
  console.error("Repair failed:", err.message || err);
  process.exit(1);
});
