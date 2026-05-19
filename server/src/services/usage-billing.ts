import { db } from "../db";
import {
  tenantBillingUsage,
  usageBillingThresholds,
  saasBillingLines,
} from "../db/schema";
import { eq, and } from "drizzle-orm";

export function currentBillingCycle(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export async function incrementUsage(
  tenantId: string,
  metric: string,
  amount: number,
  cycle = currentBillingCycle(),
) {
  const [existing] = await db
    .select()
    .from(tenantBillingUsage)
    .where(
      and(
        eq(tenantBillingUsage.tenantId, tenantId),
        eq(tenantBillingUsage.metric, metric),
        eq(tenantBillingUsage.billingCycle, cycle),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(tenantBillingUsage)
      .set({
        quantityUsed: existing.quantityUsed + amount,
        updatedAt: new Date(),
      })
      .where(eq(tenantBillingUsage.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(tenantBillingUsage)
    .values({ tenantId, metric, quantityUsed: amount, billingCycle: cycle })
    .returning();
  return created;
}

export async function getTenantUsage(tenantId: string, cycle = currentBillingCycle()) {
  return db
    .select()
    .from(tenantBillingUsage)
    .where(and(eq(tenantBillingUsage.tenantId, tenantId), eq(tenantBillingUsage.billingCycle, cycle)));
}

export async function checkUsageAllowed(tenantId: string, metric: string, addAmount = 1): Promise<{
  allowed: boolean;
  used: number;
  included: number;
  reason?: string;
}> {
  const cycle = currentBillingCycle();
  const rows = await getTenantUsage(tenantId, cycle);
  const used = rows.find((r) => r.metric === metric)?.quantityUsed ?? 0;
  const [threshold] = await db
    .select()
    .from(usageBillingThresholds)
    .where(eq(usageBillingThresholds.metric, metric))
    .limit(1);

  const included = threshold?.includedQuantity ?? Number.MAX_SAFE_INTEGER;
  if (used + addAmount <= included) {
    return { allowed: true, used, included };
  }
  return {
    allowed: false,
    used,
    included,
    reason: `Usage cap exceeded for ${metric} (${used + addAmount} > ${included})`,
  };
}

export async function computeUsageOverageLines(tenantId: string, cycle = currentBillingCycle()) {
  const usage = await getTenantUsage(tenantId, cycle);
  const thresholds = await db.select().from(usageBillingThresholds);
  const lines: {
    metric: string;
    description: string;
    quantity: number;
    unitAmount: number;
    amount: number;
  }[] = [];

  for (const u of usage) {
    const th = thresholds.find((t) => t.metric === u.metric);
    if (!th) continue;
    const over = Math.max(0, u.quantityUsed - th.includedQuantity);
    if (over <= 0) continue;
    lines.push({
      metric: u.metric,
      description: `${u.metric} overage (${over} units)`,
      quantity: over,
      unitAmount: th.overageUnitPrice,
      amount: over * th.overageUnitPrice,
    });
  }
  return lines;
}

export async function generateBillingLines(tenantId: string, cycle = currentBillingCycle()) {
  await db
    .delete(saasBillingLines)
    .where(and(eq(saasBillingLines.tenantId, tenantId), eq(saasBillingLines.billingCycle, cycle)));

  const overageLines = await computeUsageOverageLines(tenantId, cycle);
  const inserted = [];
  for (const line of overageLines) {
    const [row] = await db
      .insert(saasBillingLines)
      .values({
        tenantId,
        billingCycle: cycle,
        lineType: "usage_overage",
        description: line.description,
        quantity: line.quantity,
        unitAmount: line.unitAmount,
        amount: line.amount,
        metric: line.metric,
      })
      .returning();
    inserted.push(row);
  }
  return inserted;
}

export async function getBillingLines(tenantId: string, cycle = currentBillingCycle()) {
  return db
    .select()
    .from(saasBillingLines)
    .where(and(eq(saasBillingLines.tenantId, tenantId), eq(saasBillingLines.billingCycle, cycle)));
}
