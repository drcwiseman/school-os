/**
 * One-time: rewrite platform marketing siteUrl from school.bclimaxtech.com → masomobest.com
 * Run on VPS: cd ~/school-os/server && npx tsx scripts/migrate-site-url-to-masomobest.ts
 */
import "../src/load-env";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { platformSettings } from "../src/db/schema";
import { DEFAULT_APP_ORIGIN, normalizeAppOrigin } from "../src/lib/app-origin";

const MARKETING_KEY = "marketing";

async function main() {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, MARKETING_KEY)).limit(1);
  if (!row) {
    console.log("No marketing settings row — defaults will use", DEFAULT_APP_ORIGIN);
    process.exit(0);
  }
  const v = (row.value ?? {}) as Record<string, unknown>;
  const before = String(v.siteUrl ?? "");
  const after = normalizeAppOrigin(before || DEFAULT_APP_ORIGIN);
  if (before === after) {
    console.log("siteUrl already correct:", after);
    process.exit(0);
  }
  await db
    .update(platformSettings)
    .set({ value: { ...v, siteUrl: after }, updatedAt: new Date() })
    .where(eq(platformSettings.key, MARKETING_KEY));
  console.log("Updated marketing.siteUrl:");
  console.log("  before:", before || "(empty)");
  console.log("  after: ", after);
  console.log("\nEnsure server/.env has:");
  console.log("  CLIENT_ORIGIN=https://masomobest.com");
  console.log("  PLATFORM_DOMAIN=masomobest.com");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
