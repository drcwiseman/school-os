import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { splitMigrationSql } from "./sql-runner";

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function runStatement(stmt: string, verbose: boolean) {
  const trimmed = stmt.trim();
  if (!trimmed) return;
  try {
    await db.execute(sql.raw(trimmed));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (
      e.code === "42710" ||
      e.code === "42P07" ||
      e.message?.includes("already exists") ||
      e.message?.includes("duplicate")
    ) {
      if (verbose) console.log(`  · skip (exists)`);
      return;
    }
    if (verbose) console.warn(`  · warn: ${e.message?.slice(0, 120)}`);
    else console.warn(`[sql-migrate] ${e.message?.slice(0, 100)}`);
  }
}

/**
 * Apply every *.sql file in migrations/ (except full_schema). Idempotent.
 * Required on VPS because drizzle journal ends at 0017 while code expects 0025.
 */
export async function runAllSqlMigrationFiles(verbose = false) {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && f !== "full_schema.sql")
    .sort();

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    if (verbose) console.log(`\n── ${file} ──`);
    const parts = splitMigrationSql(fs.readFileSync(filePath, "utf8"));
    for (const part of parts) {
      await runStatement(part, verbose);
    }
  }
}
