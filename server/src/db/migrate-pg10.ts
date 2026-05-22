/**
 * PostgreSQL 10+ migrator without a wrapping transaction.
 * Drizzle's default migrator runs all pending files in one transaction, which breaks
 * `ALTER TYPE ... ADD VALUE` on older PostgreSQL (CWP/VPS).
 */
import { sql } from "drizzle-orm";
import { db } from "./index";
import { applyFacilitiesBaseTables } from "./facilities-base-sql";
import { applyFacilitiesOperationsTables } from "./facilities-operations-sql";
import { splitMigrationSql } from "./sql-runner";
import path from "path";
import fs from "fs";
import crypto from "node:crypto";

const MIGRATIONS_FOLDER = path.join(__dirname, "migrations");
const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

async function ensureMigrationsTable() {
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `));
}

async function getLastAppliedMillis(): Promise<number> {
  const result = await db.execute<{ created_at: string }>(sql.raw(
    `SELECT created_at FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ORDER BY created_at DESC LIMIT 1`,
  ));
  const row = result.rows[0];
  return row ? Number(row.created_at) : 0;
}

async function isEnumValuePresent(typeName: string, label: string): Promise<boolean> {
  const result = await db.execute<{ ok: number }>(sql.raw(`
    SELECT 1 AS ok FROM pg_enum e
    INNER JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = '${typeName}' AND e.enumlabel = '${label}'
    LIMIT 1
  `));
  return result.rows.length > 0;
}

async function runStatement(stmt: string) {
  const trimmed = stmt.trim();
  if (!trimmed) return;

  const enumMatch = /^ALTER TYPE "([^"]+)" ADD VALUE '([^']+)'/i.exec(trimmed);
  if (enumMatch) {
    const [, typeName, label] = enumMatch;
    if (await isEnumValuePresent(typeName, label)) {
      console.log(`  · skip enum ${typeName}.${label} (exists)`);
      return;
    }
  }

  try {
    await db.execute(sql.raw(trimmed));
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "42710" || e.message?.includes("already exists")) {
      console.log(`  · skip (exists): ${trimmed.slice(0, 60)}…`);
      return;
    }
    throw err;
  }
}

async function main() {
  console.log("Running migrations (PG10-safe, no wrap transaction)…");
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await ensureMigrationsTable();

  console.log("· ensure facilities operations tables (library cards, rooms, tickets…)");
  await applyFacilitiesOperationsTables(runStatement);

  const lastMillis = await getLastAppliedMillis();
  const journal = JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8"),
  );

  for (const entry of journal.entries as { tag: string; when: number }[]) {
    if (entry.when <= lastMillis) continue;

    const filePath = path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
    const query = fs.readFileSync(filePath, "utf8");
    const statements = splitMigrationSql(query);
    const hash = crypto.createHash("sha256").update(query).digest("hex");

    console.log(`\n▶ ${entry.tag}`);
    if (entry.tag === "0022_phase_d") {
      console.log("  · ensure transport/library/boarding base tables");
      await applyFacilitiesBaseTables(runStatement);
    }
    for (const stmt of statements) {
      await runStatement(stmt);
    }

    await db.execute(sql.raw(
      `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (hash, created_at) VALUES ('${hash}', ${entry.when})`,
    ));
    console.log("  ✓ recorded");
  }

  const features = await db.execute<{ t: string | null }>(sql`
    SELECT to_regclass('public.features')::text AS t
  `);
  if (!features.rows[0]?.t) {
    console.log("\n⚠ features table missing — re-applying 0004_architecture_hardening.sql");
    const q = fs.readFileSync(path.join(MIGRATIONS_FOLDER, "0004_architecture_hardening.sql"), "utf8");
    for (const stmt of splitMigrationSql(q)) {
      await runStatement(stmt);
    }
  }

  console.log("\nMigrations complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
