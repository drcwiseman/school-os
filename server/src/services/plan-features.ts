import { db } from "../db";
import { plans, tenantPlans } from "../db/schema";
import { eq } from "drizzle-orm";
import { getTenantFeatureFlags } from "./tenant-features";
import { isAddonFeatureAllowed } from "./tenant-addons";

/** Plan entitlements from subscription tier — null if school has no plan assigned. */
export async function getTenantPlanFeatures(tenantId: string): Promise<Record<string, boolean> | null> {
  const [row] = await db
    .select({ featuresJson: plans.featuresJson })
    .from(tenantPlans)
    .innerJoin(plans, eq(tenantPlans.planId, plans.id))
    .where(eq(tenantPlans.tenantId, tenantId))
    .limit(1);

  if (!row) return null;
  const raw = (row.featuresJson ?? {}) as Record<string, boolean>;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = Boolean(v);
  }
  return out;
}

/**
 * Effective feature access:
 * 1. Addon gate (premium add-ons)
 * 2. Tenant flag false → deny (platform turned off)
 * 3. Tenant flag true → allow (platform override — feature flags page / per-school toggles)
 * 4. Plan assigned → allow only if plan includes feature as true
 * 5. No plan → allow unless tenant explicitly disabled
 */
export function evaluateFeatureAccess(opts: {
  tenantFlags: Record<string, boolean>;
  planFlags: Record<string, boolean> | null;
  featureCode: string;
  addonAllowed: boolean;
}): boolean {
  if (!opts.addonAllowed) return false;
  if (opts.tenantFlags[opts.featureCode] === false) return false;
  if (opts.tenantFlags[opts.featureCode] === true) return true;
  if (opts.planFlags !== null) return opts.planFlags[opts.featureCode] === true;
  return true;
}

export async function isFeatureAllowedForTenant(tenantId: string, featureCode: string): Promise<boolean> {
  const addonAllowed = await isAddonFeatureAllowed(tenantId, featureCode);
  const tenantFlags = await getTenantFeatureFlags(tenantId);
  const planFlags = await getTenantPlanFeatures(tenantId);
  return evaluateFeatureAccess({ tenantFlags, planFlags, featureCode, addonAllowed });
}

/** All catalog features with effective access for client UI + route guards. */
export async function getTenantModuleAccess(tenantId: string): Promise<Record<string, boolean>> {
  const { listFeatureCatalog } = await import("./tenant-features");
  const catalog = await listFeatureCatalog();
  const out: Record<string, boolean> = {};
  await Promise.all(
    catalog.map(async (f) => {
      out[f.code] = await isFeatureAllowedForTenant(tenantId, f.code);
    }),
  );
  return out;
}
