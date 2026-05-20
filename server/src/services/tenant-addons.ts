import { db } from "../db";
import { addonFeatures, tenantAddons } from "../db/schema";
import { eq, and } from "drizzle-orm";

/** Addon codes that gate features (must be purchased to use). */
export const ADDON_GATED_FEATURES: Record<string, string> = {
  ai_homework: "ai_homework",
  white_label: "white_label",
  multi_campus: "multi_campus",
};

export async function listAddonCatalog() {
  return db.select().from(addonFeatures);
}

export async function getTenantAddonsDetailed(tenantId: string) {
  const catalog = await listAddonCatalog();
  const active = await db
    .select({ code: addonFeatures.code, status: tenantAddons.status })
    .from(tenantAddons)
    .innerJoin(addonFeatures, eq(tenantAddons.addonId, addonFeatures.id))
    .where(and(eq(tenantAddons.tenantId, tenantId), eq(tenantAddons.status, "active")));

  const activeCodes = new Set(active.map((a) => a.code));
  return catalog.map((a) => ({
    ...a,
    active: activeCodes.has(a.code),
  }));
}

export async function isTenantAddonActive(tenantId: string, addonCode: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tenantAddons.id })
    .from(tenantAddons)
    .innerJoin(addonFeatures, eq(tenantAddons.addonId, addonFeatures.id))
    .where(
      and(
        eq(tenantAddons.tenantId, tenantId),
        eq(addonFeatures.code, addonCode),
        eq(tenantAddons.status, "active"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function activateTenantAddon(tenantId: string, addonCode: string) {
  const [addon] = await db.select().from(addonFeatures).where(eq(addonFeatures.code, addonCode)).limit(1);
  if (!addon) return null;

  const [existing] = await db
    .select()
    .from(tenantAddons)
    .where(and(eq(tenantAddons.tenantId, tenantId), eq(tenantAddons.addonId, addon.id)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(tenantAddons)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(tenantAddons.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(tenantAddons)
    .values({ tenantId, addonId: addon.id, status: "active" })
    .returning();
  return created;
}

export async function deactivateTenantAddon(tenantId: string, addonCode: string) {
  const [addon] = await db.select().from(addonFeatures).where(eq(addonFeatures.code, addonCode)).limit(1);
  if (!addon) return;
  await db
    .update(tenantAddons)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(tenantAddons.tenantId, tenantId), eq(tenantAddons.addonId, addon.id)));
}

/** Feature allowed if not addon-gated, included on plan, or addon purchased. */
export async function isAddonFeatureAllowed(tenantId: string, featureCode: string): Promise<boolean> {
  const requiredAddon = ADDON_GATED_FEATURES[featureCode];
  if (!requiredAddon) return true;

  const { getTenantPlanFeatures } = await import("./plan-features");
  const planFlags = await getTenantPlanFeatures(tenantId);
  if (planFlags?.[featureCode] === true) return true;

  return isTenantAddonActive(tenantId, requiredAddon);
}
