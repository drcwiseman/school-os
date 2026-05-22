/**
 * One-off: create transport/library/boarding tables before journal migration 0022.
 * Run on VPS when db:migrate fails with "transport_vehicles does not exist".
 *
 *   cd /root/school-os && npm run db:ensure-facilities-base --prefix server
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { applyFacilitiesBaseTables } from "../src/db/facilities-base-sql";
import { applyFacilitiesOperationsTables } from "../src/db/facilities-operations-sql";

async function run(statement: string) {
  const trimmed = statement.trim();
  if (!trimmed) return;
  await db.execute(sql.raw(trimmed));
}

async function main() {
  console.log("Ensuring facilities base + operations tables…");
  await applyFacilitiesBaseTables(run);
  await applyFacilitiesOperationsTables(run);
  console.log("Done. Next: npm run db:migrate (if needed), then restart PM2.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
