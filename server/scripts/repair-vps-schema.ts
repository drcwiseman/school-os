/**
 * One-off repair for VPS DBs where migrations stalled at 0017 in drizzle journal.
 * Applies patch SQL + ALL migration files 0000–0025. Safe to re-run.
 */
import { applyVpsSchemaPatch } from "../src/db/vps-schema-patch";
import { runAllSqlMigrationFiles } from "../src/db/run-all-sql-migrations";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

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

async function main() {
  console.log("Repairing schema (idempotent)…\n");

  console.log("── VPS schema patch ──");
  await applyVpsSchemaPatch(run);

  for (const label of ["suspended", "disabled", "pending"]) {
    try {
      await run(`ALTER TYPE "user_status" ADD VALUE '${label}'`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (e.message?.includes("already exists")) console.log(`  · user_status.${label} exists`);
      else throw err;
    }
  }

  console.log("\n── All SQL migrations (0000–0025) ──");
  await runAllSqlMigrationFiles(true);

  console.log("\n✅ Repair applied.");
  console.log("Next: npm run build && pm2 restart school-os --update-env");
  process.exit(0);
}

main().catch((err) => {
  console.error("Repair failed:", err.message || err);
  process.exit(1);
});
