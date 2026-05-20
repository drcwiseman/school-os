import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { plans, planRegionalPrices, tenantPlans } from "../db/schema";
import { ConflictError, NotFoundError } from "../middleware/error";
import { CURRENCY_CODES } from "../lib/currencies";
import { getPlansWithRegionalPricing, listRegionalPricesForPlan } from "./plan-pricing";
import { listFeatureCatalog } from "./tenant-features";

export async function getPlanFeatureCatalog() {
  return listFeatureCatalog();
}

async function validatePlanFeatures(featuresJson: Record<string, boolean>) {
  const catalog = await listFeatureCatalog();
  const codes = new Set(catalog.map((f) => f.code));
  for (const key of Object.keys(featuresJson)) {
    if (!codes.has(key)) throw new ConflictError(`Unknown feature: ${key}`);
  }
}

export function normalizePlanCode(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function getPlanByCode(code: string) {
  const [plan] = await db.select().from(plans).where(eq(plans.code, code)).limit(1);
  if (!plan) throw new NotFoundError("Plan not found");
  const regionalPrices = await listRegionalPricesForPlan(plan.id);
  return { ...plan, regionalPrices };
}

export async function createPlan(input: {
  code: string;
  name: string;
  priceMonthly: number;
  featuresJson?: Record<string, boolean>;
}) {
  const code = normalizePlanCode(input.code);
  if (code.length < 2) throw new ConflictError("Plan code must be at least 2 characters");
  if (input.featuresJson) await validatePlanFeatures(input.featuresJson);

  const [existing] = await db.select({ id: plans.id }).from(plans).where(eq(plans.code, code)).limit(1);
  if (existing) throw new ConflictError("Plan code already exists");

  const [plan] = await db.insert(plans).values({
    code,
    name: input.name.trim(),
    priceMonthly: input.priceMonthly,
    featuresJson: input.featuresJson ?? {},
  }).returning();

  return plan;
}

export async function updatePlan(code: string, input: {
  name?: string;
  priceMonthly?: number;
  featuresJson?: Record<string, boolean>;
}) {
  const [plan] = await db.select().from(plans).where(eq(plans.code, code)).limit(1);
  if (!plan) throw new NotFoundError("Plan not found");

  const patch: Partial<typeof plans.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.priceMonthly !== undefined) patch.priceMonthly = input.priceMonthly;
  if (input.featuresJson !== undefined) {
    await validatePlanFeatures(input.featuresJson);
    patch.featuresJson = input.featuresJson;
  }

  const [updated] = await db.update(plans).set(patch).where(eq(plans.id, plan.id)).returning();
  return updated;
}

export async function deletePlan(code: string) {
  const [plan] = await db.select().from(plans).where(eq(plans.code, code)).limit(1);
  if (!plan) throw new NotFoundError("Plan not found");

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenantPlans)
    .where(eq(tenantPlans.planId, plan.id));

  if (Number(count) > 0) {
    throw new ConflictError(`Cannot delete plan: ${count} school(s) still subscribed`);
  }

  await db.delete(plans).where(eq(plans.id, plan.id));
}

export async function upsertRegionalPrice(planCode: string, input: {
  countryCode: string;
  currency: string;
  priceMonthly: number;
}) {
  const [plan] = await db.select().from(plans).where(eq(plans.code, planCode)).limit(1);
  if (!plan) throw new NotFoundError("Plan not found");

  const countryCode = (input.countryCode || "*").toUpperCase();
  const currency = input.currency.toUpperCase();
  if (!CURRENCY_CODES.has(currency)) throw new ConflictError("Unsupported currency");

  const existing = await db.select().from(planRegionalPrices).where(
    and(
      eq(planRegionalPrices.planId, plan.id),
      eq(planRegionalPrices.countryCode, countryCode),
      eq(planRegionalPrices.currency, currency),
    ),
  ).limit(1);

  if (existing[0]) {
    const [row] = await db.update(planRegionalPrices)
      .set({ priceMonthly: input.priceMonthly })
      .where(eq(planRegionalPrices.id, existing[0].id))
      .returning();
    return row;
  }

  const [row] = await db.insert(planRegionalPrices).values({
    planId: plan.id,
    countryCode,
    currency,
    priceMonthly: input.priceMonthly,
  }).returning();
  return row;
}

export async function deleteRegionalPrice(planCode: string, regionalId: string) {
  const [plan] = await db.select().from(plans).where(eq(plans.code, planCode)).limit(1);
  if (!plan) throw new NotFoundError("Plan not found");

  const [row] = await db.select().from(planRegionalPrices)
    .where(and(eq(planRegionalPrices.id, regionalId), eq(planRegionalPrices.planId, plan.id)))
    .limit(1);
  if (!row) throw new NotFoundError("Regional price not found");

  await db.delete(planRegionalPrices).where(eq(planRegionalPrices.id, regionalId));
}

export { getPlansWithRegionalPricing };
