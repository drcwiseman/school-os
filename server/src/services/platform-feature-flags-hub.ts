import { db } from "../db";
import { features, tenants, tenantSettings } from "../db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { getTenantFeatureFlags, listFeatureCatalog, setTenantFeature } from "./tenant-features";
import { isFeatureAllowedForTenant } from "./plan-features";

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
    let enabledSchools = 0;
    for (const school of schoolRows) {
      if (await isFeatureAllowedForTenant(school.id, f.code)) enabledSchools++;
    }
    rows.push({
      code: f.code,
      name: f.name,
      description: f.description,
      category: f.category,
      enabledSchools,
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

  for (const s of schools) {
    await setTenantFeature(s.id, featureCode, enabled);
    const merged = await getTenantFeatureFlags(s.id);
    await db
      .update(tenantSettings)
      .set({ featureFlagsJson: merged, updatedAt: new Date() })
      .where(eq(tenantSettings.tenantId, s.id));
  }
  return { updated: schools.length, featureCode, enabled };
}
