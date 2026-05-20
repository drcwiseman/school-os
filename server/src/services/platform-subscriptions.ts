import { db } from "../db";
import { tenants, tenantPlans, plans } from "../db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../middleware/error";
import { listPlatformTenants } from "./platform-tenants-list";
import { resolvePlanMonthlyPrice } from "./plan-pricing";
import {
  BillingInterval,
  computeRenewsAt,
  isBillingInterval,
  intervalMonthMultiplier,
} from "../lib/billing-intervals";

export type PlatformSubscriptionRow = {
  tenantId: string;
  slug: string;
  name: string;
  status: string;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  priceMonthly: number | null;
  billingInterval: BillingInterval | null;
  renewsAt: string | null;
  oneTimeAmount: number | null;
  periodAmount: number | null;
  resolvedCurrency: string | null;
  country: string | null;
  currency: string | null;
  startedAt: string | null;
  adminEmail: string | null;
};

type AssignOpts = {
  planCode: string;
  startedAt?: Date;
  billingInterval?: BillingInterval;
  oneTimeAmount?: number;
};

export async function listPlatformSubscriptions(): Promise<PlatformSubscriptionRow[]> {
  const tenantsList = await listPlatformTenants();

  type SubRow = {
    tenantId: string;
    startedAt: Date;
    planId: string;
    billingInterval: string | null;
    renewsAt: Date | null;
    oneTimeAmount: number | null;
  };

  let subRows: SubRow[];
  try {
    subRows = await db
      .select({
        tenantId: tenantPlans.tenantId,
        startedAt: tenantPlans.startedAt,
        planId: tenantPlans.planId,
        billingInterval: tenantPlans.billingInterval,
        renewsAt: tenantPlans.renewsAt,
        oneTimeAmount: tenantPlans.oneTimeAmount,
      })
      .from(tenantPlans);
  } catch (err) {
    const msg = String((err as Error).message ?? "");
    if (!msg.includes("billing_interval") && !msg.includes("renews_at") && !msg.includes("one_time_amount")) {
      throw err;
    }
    const basic = await db
      .select({
        tenantId: tenantPlans.tenantId,
        startedAt: tenantPlans.startedAt,
        planId: tenantPlans.planId,
      })
      .from(tenantPlans);
    subRows = basic.map((r) => ({
      ...r,
      billingInterval: "monthly",
      renewsAt: null,
      oneTimeAmount: null,
    }));
  }

  const subMap = new Map(subRows.map((r) => [r.tenantId, r]));

  const result: PlatformSubscriptionRow[] = [];

  for (const t of tenantsList) {
    const tp = subMap.get(t.id);
    let priceMonthly: number | null = null;
    let resolvedCurrency = t.currency ?? null;
    let billingInterval: BillingInterval | null = null;
    let periodAmount: number | null = null;

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
      if (tp.billingInterval && isBillingInterval(tp.billingInterval)) {
        billingInterval = tp.billingInterval;
        if (billingInterval === "lifetime" && tp.oneTimeAmount != null) {
          periodAmount = tp.oneTimeAmount;
        } else if (priceMonthly != null) {
          const mult = intervalMonthMultiplier(billingInterval);
          periodAmount = mult > 0 ? priceMonthly * mult : null;
        }
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
      billingInterval,
      renewsAt: tp?.renewsAt ? tp.renewsAt.toISOString() : null,
      oneTimeAmount: tp?.oneTimeAmount ?? null,
      periodAmount,
      resolvedCurrency,
      country: t.country ?? null,
      currency: t.currency ?? null,
      startedAt: tp?.startedAt ? tp.startedAt.toISOString() : null,
      adminEmail: t.adminEmail ?? null,
    });
  }

  return result;
}

export async function assignTenantPlan(tenantSlug: string, opts: AssignOpts) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!tenant) throw new NotFoundError("School not found");

  const [plan] = await db.select().from(plans).where(eq(plans.code, opts.planCode)).limit(1);
  if (!plan) throw new NotFoundError("Plan not found");

  const interval: BillingInterval = opts.billingInterval && isBillingInterval(opts.billingInterval)
    ? opts.billingInterval
    : "monthly";
  const startedAt = opts.startedAt ?? new Date();
  const renewsAt = computeRenewsAt(startedAt, interval);

  await db.delete(tenantPlans).where(eq(tenantPlans.tenantId, tenant.id));
  await db.insert(tenantPlans).values({
    tenantId: tenant.id,
    planId: plan.id,
    startedAt,
    billingInterval: interval,
    renewsAt,
    oneTimeAmount: interval === "lifetime" ? (opts.oneTimeAmount ?? null) : null,
  });

  return { tenant, plan, billingInterval: interval };
}

export async function updateTenantSubscription(
  tenantSlug: string,
  patch: Partial<AssignOpts & { startedAt?: Date }>,
) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!tenant) throw new NotFoundError("School not found");

  if (patch.planCode) {
    return assignTenantPlan(tenantSlug, {
      planCode: patch.planCode,
      startedAt: patch.startedAt,
      billingInterval: patch.billingInterval,
      oneTimeAmount: patch.oneTimeAmount,
    });
  }

  const [tp] = await db.select().from(tenantPlans).where(eq(tenantPlans.tenantId, tenant.id)).limit(1);
  if (!tp) throw new NotFoundError("No subscription for this school");

  const interval = patch.billingInterval && isBillingInterval(patch.billingInterval)
    ? patch.billingInterval
    : (tp.billingInterval as BillingInterval);
  const startedAt = patch.startedAt ?? tp.startedAt;

  await db.update(tenantPlans).set({
    startedAt,
    billingInterval: interval,
    renewsAt: computeRenewsAt(startedAt, interval),
    oneTimeAmount: interval === "lifetime"
      ? (patch.oneTimeAmount ?? tp.oneTimeAmount)
      : null,
  }).where(eq(tenantPlans.tenantId, tenant.id));

  return { tenant };
}

export async function removeTenantPlan(tenantSlug: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!tenant) throw new NotFoundError("School not found");
  await db.delete(tenantPlans).where(eq(tenantPlans.tenantId, tenant.id));
  return tenant;
}
