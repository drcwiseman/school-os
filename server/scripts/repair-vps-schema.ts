/**
 * One-off repair for VPS DBs where migrations stalled mid-way.
 * Each statement auto-commits. Safe to re-run.
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { splitMigrationSql } from "../src/db/sql-runner";
import { applyVpsSchemaPatch } from "../src/db/vps-schema-patch";
import fs from "fs";
import path from "path";

const MIGRATIONS = path.join(__dirname, "../src/db/migrations");

async function run(statement: string) {
  const trimmed = statement.trim();
  if (!trimmed) return;
  const label = trimmed.replace(/\s+/g, " ").trim().slice(0, 90);
  console.log(`→ ${label}`);
  try {
    await db.execute(sql.raw(trimmed));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "42710" || e.message?.includes("already exists")) {
      console.log(`  · already exists, skipping`);
      return;
    }
    throw err;
  }
}

async function runSqlFile(filename: string) {
  const filePath = path.join(MIGRATIONS, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`Skip missing ${filename}`);
    return;
  }
  console.log(`\n── ${filename} ──`);
  const parts = splitMigrationSql(fs.readFileSync(filePath, "utf8"));
  for (const part of parts) {
    await run(part);
  }
}

async function main() {
  console.log("Repairing schema (idempotent)…\n");

  console.log("── VPS schema patch (0019–0025 columns) ──");
  await applyVpsSchemaPatch(run);

  await run(
    `ALTER TABLE "platform_admins" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'super_admin'`,
  );

  for (const label of ["suspended", "disabled", "pending"]) {
    try {
      await run(`ALTER TYPE "user_status" ADD VALUE '${label}'`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (e.message?.includes("already exists")) console.log(`  · user_status.${label} exists`);
      else throw err;
    }
  }

  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (file === "full_schema.sql") continue;
    await runSqlFile(file);
  }

  console.log("\n✅ Repair applied.");
  console.log("Next: npm run build && pm2 restart school-os --update-env");
  process.exit(0);
}

main().catch((err) => {
  console.error("Repair failed:", err.message || err);
  process.exit(1);
});
