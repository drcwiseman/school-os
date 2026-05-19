/**
 * Print DB connectivity + critical schema checks. Run on VPS:
 *   npm run db:doctor --prefix server
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { verifyPassword } from "../middleware/auth";

async function main() {
  console.log("DATABASE_URL host:", (process.env.DATABASE_URL ?? "").replace(/:[^:@]+@/, ":****@"));

  const ver = await db.execute<{ v: string }>(sql`SELECT version() AS v`);
  console.log("PostgreSQL:", ver.rows[0]?.v?.split("\n")[0]);

  const cols = await db.execute<{ column_name: string }>(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_admins'
    ORDER BY ordinal_position
  `);
  console.log("platform_admins columns:", cols.rows.map((r) => r.column_name).join(", ") || "(missing table)");

  const admins = await db.execute<{ email: string; role: string | null }>(sql`
    SELECT email, role FROM platform_admins LIMIT 5
  `);
  console.log("platform_admins rows:", admins.rows.length ? admins.rows : "(none)");

  const [row] = await db.execute<{ password_hash: string }>(sql`
    SELECT password_hash FROM platform_admins WHERE email = 'platform@schoolos.local' LIMIT 1
  `);
  if (!row.rows[0]) {
    console.log("❌ No platform@schoolos.local — run: npm run db:ensure-platform");
    process.exit(1);
  }
  const ok = await verifyPassword("Platform123!", row.rows[0].password_hash);
  console.log(ok ? "✅ Password Platform123! matches" : "❌ Password does not match (re-run db:ensure-platform or reset hash)");

  const features = await db.execute(sql`SELECT to_regclass('public.features') AS t`);
  console.log("features table:", (features.rows[0] as { t: string | null })?.t ?? "missing");

  console.log("\nDone.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
