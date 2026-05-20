import { db } from "../db";
import { features, tenantFeatures, tenants } from "../db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { listFeatureCatalog } from "./tenant-features";

export type FeatureFlagOverviewRow = {
  code: string;
  name: string;
  description: string;
  category: string;
  enabledSchools: number;
  totalSchools: number;
};

export type PlatformFeatureFlagsHub = {
  totalSchools: number;
  features: FeatureFlagOverviewRow[];
  schools: { id: string; slug: string; name: string; status: string }[];
};

export async function getPlatformFeatureFlagsHub(): Promise<PlatformFeatureFlagsHub> {
  const catalog = await listFeatureCatalog();
  const schoolRows = await db
    .select({ id: tenants.id, slug: tenants.slug, name: tenants.name, status: tenants.status })
    .from(tenants)
    .orderBy(asc(tenants.name));

  const totalSchools = schoolRows.length;
  const rows: FeatureFlagOverviewRow[] = [];

  for (const f of catalog) {
    const [count] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(tenantFeatures)
      .where(and(eq(tenantFeatures.featureId, f.id), eq(tenantFeatures.enabled, true)));
    rows.push({
      code: f.code,
      name: f.name,
      description: f.description,
      category: f.category,
      enabledSchools: Number(count?.c ?? 0),
      totalSchools,
    });
  }

  return { totalSchools, features: rows, schools: schoolRows };
}

export async function bulkSetFeatureForSchools(
  featureCode: string,
  enabled: boolean,
  tenantIds?: string[],
) {
  const [feature] = await db.select().from(features).where(eq(features.code, featureCode)).limit(1);
  if (!feature) throw new Error("Unknown feature code");

  const schools = tenantIds?.length
    ? await db.select().from(tenants).where(inArray(tenants.id, tenantIds))
    : await db.select().from(tenants);

  const { setTenantFeature } = await import("./tenant-features");
  for (const s of schools) {
    await setTenantFeature(s.id, featureCode, enabled);
  }
  return { updated: schools.length, featureCode, enabled };
}
