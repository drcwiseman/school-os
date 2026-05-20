import { db } from "../db";
import { tenants, tenantPlans, plans } from "../db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../middleware/error";
import { listPlatformTenants } from "./platform-tenants-list";
import { resolvePlanMonthlyPrice } from "./plan-pricing";

export type PlatformSubscriptionRow = {
  tenantId: string;
  slug: string;
  name: string;
  status: string;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  priceMonthly: number | null;
  resolvedCurrency: string | null;
  country: string | null;
  currency: string | null;
  startedAt: string | null;
  adminEmail: string | null;
};

export async function listPlatformSubscriptions(): Promise<PlatformSubscriptionRow[]> {
  const tenantsList = await listPlatformTenants();

  const startedRows = await db
    .select({
      tenantId: tenantPlans.tenantId,
      startedAt: tenantPlans.startedAt,
      planId: tenantPlans.planId,
    })
    .from(tenantPlans);

  const startedMap = new Map(startedRows.map((r) => [r.tenantId, r]));

  const result: PlatformSubscriptionRow[] = [];

  for (const t of tenantsList) {
    const tp = startedMap.get(t.id);
    let priceMonthly: number | null = null;
    let resolvedCurrency = t.currency ?? null;

    if (tp?.planId) {
      const [plan] = await db.select().from(plans).where(eq(plans.id, tp.planId)).limit(1);
      if (plan) {
        const resolved = await resolvePlanMonthlyPrice({
          planId: plan.id,
          countryCode: t.country,
          currency: t.currency,
          basePriceMonthly: plan.priceMonthly,
        });
        priceMonthly = resolved.priceMonthly;
        resolvedCurrency = resolved.currency;
      }
    }

    result.push({
      tenantId: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      planId: tp?.planId ?? null,
      planCode: t.planCode ?? null,
      planName: t.planName ?? null,
      priceMonthly,
      resolvedCurrency,
      country: t.country ?? null,
      currency: t.currency ?? null,
      startedAt: tp?.startedAt ? tp.startedAt.toISOString() : null,
      adminEmail: t.adminEmail ?? null,
    });
  }

  return result;
}

export async function assignTenantPlan(tenantSlug: string, planCode: string, startedAt?: Date) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!tenant) throw new NotFoundError("School not found");

  const [plan] = await db.select().from(plans).where(eq(plans.code, planCode)).limit(1);
  if (!plan) throw new NotFoundError("Plan not found");

  await db.delete(tenantPlans).where(eq(tenantPlans.tenantId, tenant.id));
  await db.insert(tenantPlans).values({
    tenantId: tenant.id,
    planId: plan.id,
    startedAt: startedAt ?? new Date(),
  });

  return { tenant, plan };
}

export async function removeTenantPlan(tenantSlug: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!tenant) throw new NotFoundError("School not found");
  await db.delete(tenantPlans).where(eq(tenantPlans.tenantId, tenant.id));
  return tenant;
}
