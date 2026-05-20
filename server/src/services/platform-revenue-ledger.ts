import { db } from "../db";
import { payments, tenants, tenantSettings } from "../db/schema";
import { sql, isNull, desc, eq } from "drizzle-orm";
import { getPlatformDefaults } from "./platform-settings";
import { convertMinor } from "./currency-exchange";
import { listPlatformSubscriptions, type PlatformSubscriptionRow } from "./platform-subscriptions";
import {
  BillingInterval,
  intervalMonthMultiplier,
  isBillingInterval,
} from "../lib/billing-intervals";

export type RevenueSchoolRow = {
  tenantId: string;
  slug: string;
  name: string;
  status: string;
  planName: string | null;
  planCode: string | null;
  billingInterval: BillingInterval | null;
  resolvedCurrency: string | null;
  periodAmount: number | null;
  mrrMinor: number;
  mrrDisplayMinor: number;
  renewsAt: string | null;
  feeVolumeTotal: number;
  feeVolume30d: number;
  feeVolumeDisplayMinor: number;
  feeVolume30dDisplayMinor: number;
  overdue: boolean;
};

export type RecentPaymentRow = {
  id: string;
  tenantSlug: string;
  tenantName: string;
  amount: number;
  currency: string;
  amountDisplayMinor: number;
  method: string;
  paidAt: string;
};

export type PlatformRevenueLedger = {
  displayCurrency: string;
  fxProvider: string;
  summary: {
    saasMrr: number;
    saasArr: number;
    saasLifetimeTotal: number;
    feeVolumeTotal: number;
    feeVolume30d: number;
    activeBillableSchools: number;
    subscribedSchools: number;
    renewalsNext30d: number;
    overdueRenewals: number;
  };
  schools: RevenueSchoolRow[];
  recentPayments: RecentPaymentRow[];
};

function subscriptionMrrMinor(sub: PlatformSubscriptionRow): number {
  if (!sub.planCode || !sub.resolvedCurrency) return 0;
  if (sub.billingInterval === "lifetime") return 0;
  if (sub.priceMonthly != null) return sub.priceMonthly;
  if (sub.periodAmount != null && sub.billingInterval && isBillingInterval(sub.billingInterval)) {
    const mult = intervalMonthMultiplier(sub.billingInterval);
    if (mult > 0) return Math.round(sub.periodAmount / mult);
  }
  return 0;
}

export async function getPlatformRevenueLedger(): Promise<PlatformRevenueLedger> {
  const defaults = await getPlatformDefaults();
  const displayCurrency = defaults.displayCurrency;

  const subs = await listPlatformSubscriptions();

  const feeAgg = await db.execute<{
    tenant_id: string;
    currency: string;
    total: string;
    last_30: string;
  }>(sql`
    SELECT p.tenant_id,
      COALESCE(MAX(ts.currency), 'USD') AS currency,
      SUM(p.amount)::text AS total,
      SUM(CASE WHEN p.paid_at >= NOW() - INTERVAL '30 days' THEN p.amount ELSE 0 END)::text AS last_30
    FROM payments p
    LEFT JOIN tenant_settings ts ON ts.tenant_id = p.tenant_id
    WHERE p.deleted_at IS NULL
    GROUP BY p.tenant_id
  `);

  const feeByTenant = new Map<string, { total: number; last30: number; currency: string }>();
  for (const row of feeAgg.rows) {
    feeByTenant.set(row.tenant_id, {
      total: Number(row.total ?? 0),
      last30: Number(row.last_30 ?? 0),
      currency: (row.currency ?? "USD").toUpperCase(),
    });
  }

  const now = Date.now();
  const in30d = now + 30 * 24 * 60 * 60 * 1000;

  let saasMrr = 0;
  let saasLifetimeTotal = 0;
  let renewalsNext30d = 0;
  let overdueRenewals = 0;

  const schools: RevenueSchoolRow[] = [];

  for (const sub of subs) {
    const fee = feeByTenant.get(sub.tenantId);
    const feeCur = fee?.currency ?? sub.resolvedCurrency ?? displayCurrency;
    const feeTotal = fee?.total ?? 0;
    const fee30 = fee?.last30 ?? 0;

    const feeVolumeDisplayMinor = feeTotal > 0
      ? await convertMinor(feeTotal, feeCur, displayCurrency)
      : 0;
    const feeVolume30dDisplayMinor = fee30 > 0
      ? await convertMinor(fee30, feeCur, displayCurrency)
      : 0;

    const mrrMinor = subscriptionMrrMinor(sub);
    const cur = sub.resolvedCurrency ?? displayCurrency;
    const mrrDisplayMinor = mrrMinor > 0
      ? await convertMinor(mrrMinor, cur, displayCurrency)
      : 0;

    if (sub.billingInterval === "lifetime" && sub.oneTimeAmount != null && sub.resolvedCurrency) {
      saasLifetimeTotal += await convertMinor(sub.oneTimeAmount, sub.resolvedCurrency, displayCurrency);
    } else if (mrrDisplayMinor > 0) {
      saasMrr += mrrDisplayMinor;
    }

    let overdue = false;
    if (sub.renewsAt && sub.billingInterval !== "lifetime") {
      const renewTs = new Date(sub.renewsAt).getTime();
      if (renewTs >= now && renewTs <= in30d) renewalsNext30d += 1;
      if (renewTs < now && sub.status === "active" && sub.planCode) {
        overdue = true;
        overdueRenewals += 1;
      }
    }

    if (!sub.planCode && sub.status !== "active") {
      // still include in table for fee volume visibility
    }

    schools.push({
      tenantId: sub.tenantId,
      slug: sub.slug,
      name: sub.name,
      status: sub.status,
      planName: sub.planName,
      planCode: sub.planCode,
      billingInterval: sub.billingInterval,
      resolvedCurrency: sub.resolvedCurrency,
      periodAmount: sub.periodAmount,
      mrrMinor,
      mrrDisplayMinor,
      renewsAt: sub.renewsAt,
      feeVolumeTotal: feeTotal,
      feeVolume30d: fee30,
      feeVolumeDisplayMinor,
      feeVolume30dDisplayMinor,
      overdue,
    });
  }

  schools.sort((a, b) => b.mrrDisplayMinor - a.mrrDisplayMinor || b.feeVolumeDisplayMinor - a.feeVolumeDisplayMinor);

  let feeVolumeTotal = 0;
  let feeVolume30d = 0;
  for (const [, v] of feeByTenant) {
    feeVolumeTotal += await convertMinor(v.total, v.currency, displayCurrency);
    feeVolume30d += await convertMinor(v.last30, v.currency, displayCurrency);
  }

  const recentRows = await db
    .select({
      id: payments.id,
      tenantId: payments.tenantId,
      amount: payments.amount,
      method: payments.method,
      paidAt: payments.paidAt,
      slug: tenants.slug,
      name: tenants.name,
      currency: tenantSettings.currency,
    })
    .from(payments)
    .innerJoin(tenants, eq(tenants.id, payments.tenantId))
    .leftJoin(tenantSettings, eq(tenantSettings.tenantId, payments.tenantId))
    .where(isNull(payments.deletedAt))
    .orderBy(desc(payments.paidAt))
    .limit(50);

  const recentPayments: RecentPaymentRow[] = [];
  for (const p of recentRows) {
    const cur = (p.currency ?? "USD").toUpperCase();
    recentPayments.push({
      id: p.id,
      tenantSlug: p.slug,
      tenantName: p.name,
      amount: p.amount,
      currency: cur,
      amountDisplayMinor: await convertMinor(p.amount, cur, displayCurrency),
      method: p.method,
      paidAt: p.paidAt.toISOString(),
    });
  }

  const subscribedSchools = subs.filter((s) => s.planCode).length;
  const activeBillableSchools = subs.filter((s) => s.status === "active" && s.planCode).length;

  return {
    displayCurrency,
    fxProvider: "frankfurter.app",
    summary: {
      saasMrr,
      saasArr: saasMrr * 12,
      saasLifetimeTotal,
      feeVolumeTotal,
      feeVolume30d,
      activeBillableSchools,
      subscribedSchools,
      renewalsNext30d,
      overdueRenewals,
    },
    schools,
    recentPayments,
  };
}
