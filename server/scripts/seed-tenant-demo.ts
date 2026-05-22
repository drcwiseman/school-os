#!/usr/bin/env npx tsx
/**
 * Seed full Uganda secondary demo for a tenant slug.
 *   npx tsx server/scripts/seed-tenant-demo.ts school-b
 *   npx tsx server/scripts/seed-tenant-demo.ts school-b --full
 */
import { db } from "../src/db";
import { tenants } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { seedDemoDataForTenant } from "../src/services/tenant-demo-seed";

async function main() {
  const slug = process.argv[2];
  const full = process.argv.includes("--full");
  if (!slug) {
    console.error("Usage: npx tsx server/scripts/seed-tenant-demo.ts <school-slug> [--full]");
    process.exit(1);
  }
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant) {
    console.error(`Tenant not found: ${slug}`);
    process.exit(1);
  }
  const result = await seedDemoDataForTenant(tenant.id, { full });
  console.log(result.message);
  console.log("Stats:", result.stats);
  console.log("Created:", result.created.length, "items");
  console.log("\nSample logins:");
  for (const c of result.credentials) {
    console.log(`  ${c.label}: ${c.email} / ${c.password}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
