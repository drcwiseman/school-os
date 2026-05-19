import { eq, and, or } from "drizzle-orm";
import { db } from "../db";
import { plans, planRegionalPrices } from "../db/schema";
import { defaultCurrencyForCountry } from "../lib/currencies";

export async function listRegionalPricesForPlan(planId: string) {
  return db.select().from(planRegionalPrices).where(eq(planRegionalPrices.planId, planId));
}

export async function resolvePlanMonthlyPrice(opts: {
  planId: string;
  countryCode?: string | null;
  currency?: string | null;
  basePriceMonthly: number;
}): Promise<{ priceMonthly: number; currency: string; source: "regional" | "base" }> {
  const country = (opts.countryCode ?? "").toUpperCase() || "*";
  const currency = (opts.currency ?? defaultCurrencyForCountry(country === "*" ? "" : country)).toUpperCase();

  const regional = await db.select().from(planRegionalPrices).where(eq(planRegionalPrices.planId, opts.planId));

  const exact = regional.find((r) => r.countryCode === country && r.currency === currency);
  if (exact) return { priceMonthly: exact.priceMonthly, currency, source: "regional" };

  const byCurrency = regional.find((r) => (r.countryCode === "*" || r.countryCode === "") && r.currency === currency);
  if (byCurrency) return { priceMonthly: byCurrency.priceMonthly, currency, source: "regional" };

  const global = regional.find((r) => r.countryCode === "*" && r.currency === "USD");
  if (global && currency === "USD") return { priceMonthly: global.priceMonthly, currency: "USD", source: "regional" };

  return { priceMonthly: opts.basePriceMonthly, currency: currency || "USD", source: "base" };
}

export async function getPlansWithRegionalPricing(countryCode?: string, currency?: string) {
  const allPlans = await db.select().from(plans);
  const allRegional = await db.select().from(planRegionalPrices);
  return Promise.all(
    allPlans.map(async (plan) => {
      const regional = allRegional.filter((r) => r.planId === plan.id);
      const resolved = await resolvePlanMonthlyPrice({
        planId: plan.id,
        countryCode,
        currency,
        basePriceMonthly: plan.priceMonthly,
      });
      return { ...plan, regionalPrices: regional, resolvedPrice: resolved };
    }),
  );
}
