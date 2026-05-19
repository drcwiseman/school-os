import { db } from "../db";
import { features, tenantFeatures, tenantSettings } from "../db/schema";
import { eq, and } from "drizzle-orm";

const LEGACY_FLAG_MAP: Record<string, string> = {
  results_visible: "results_visible",
  fees_must_be_clear: "fees_must_be_clear",
  portal_enabled: "portal_enabled",
  messaging_enabled: "messaging_enabled",
};

/** Load enabled feature codes for a tenant (relational + legacy JSON fallback). */
export async function getTenantFeatureFlags(tenantId: string): Promise<Record<string, boolean>> {
  const rows = await db
    .select({ code: features.code, enabled: tenantFeatures.enabled })
    .from(tenantFeatures)
    .innerJoin(features, eq(tenantFeatures.featureId, features.id))
    .where(eq(tenantFeatures.tenantId, tenantId));

  const out: Record<string, boolean> = {};
  for (const r of rows) out[r.code] = r.enabled;

  if (Object.keys(out).length === 0) {
    const [settings] = await db
      .select({ featureFlagsJson: tenantSettings.featureFlagsJson })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);
    const legacy = (settings?.featureFlagsJson ?? {}) as Record<string, boolean>;
    for (const [k, v] of Object.entries(legacy)) {
      out[LEGACY_FLAG_MAP[k] ?? k] = v;
    }
  }

  return out;
}

export async function isTenantFeatureEnabled(tenantId: string, code: string): Promise<boolean> {
  const flags = await getTenantFeatureFlags(tenantId);
  return flags[code] !== false;
}

export async function setTenantFeature(
  tenantId: string,
  code: string,
  enabled: boolean,
): Promise<void> {
  const [feature] = await db.select().from(features).where(eq(features.code, code)).limit(1);
  if (!feature) return;
  const [existing] = await db
    .select()
    .from(tenantFeatures)
    .where(and(eq(tenantFeatures.tenantId, tenantId), eq(tenantFeatures.featureId, feature.id)))
    .limit(1);
  if (existing) {
    await db
      .update(tenantFeatures)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(tenantFeatures.id, existing.id));
  } else {
    await db.insert(tenantFeatures).values({ tenantId, featureId: feature.id, enabled });
  }
}
