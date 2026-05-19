import { db } from "../db";
import { plans, tenantPlans } from "../db/schema";
import { eq } from "drizzle-orm";
import { getTenantFeatureFlags } from "./tenant-features";
import { isAddonFeatureAllowed } from "./tenant-addons";

/** Plan-level feature flags from subscription tier (features_json on plans). */
export async function getTenantPlanFeatures(tenantId: string): Promise<Record<string, boolean>> {
  const [row] = await db
    .select({ featuresJson: plans.featuresJson })
    .from(tenantPlans)
    .innerJoin(plans, eq(tenantPlans.planId, plans.id))
    .where(eq(tenantPlans.tenantId, tenantId))
    .limit(1);

  const raw = (row?.featuresJson ?? {}) as Record<string, boolean>;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = v;
  }
  return out;
}

/** Tenant toggle AND plan must allow the feature (both default true if unset). */
export async function isFeatureAllowedForTenant(tenantId: string, featureCode: string): Promise<boolean> {
  if (!(await isAddonFeatureAllowed(tenantId, featureCode))) return false;
  const tenantFlags = await getTenantFeatureFlags(tenantId);
  const planFlags = await getTenantPlanFeatures(tenantId);
  if (tenantFlags[featureCode] === false) return false;
  if (planFlags[featureCode] === false) return false;
  return true;
}
