import { db } from "../db";
import { tenants } from "../db/schema";
import { eq } from "drizzle-orm";

/** URL-safe slug from a school display name. */
export function slugifySchoolName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length >= 2 ? base : "school";
}

/** Pick a unique tenant slug (appends -2, -3, … if taken). */
export async function uniqueTenantSlug(name: string, excludeTenantId?: string): Promise<string> {
  const base = slugifySchoolName(name);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const [row] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, candidate)).limit(1);
    if (!row || row.id === excludeTenantId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
