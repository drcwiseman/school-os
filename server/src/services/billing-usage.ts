import { db } from "../db";
import { tenantBillingUsage } from "../db/schema";
import { eq, and } from "drizzle-orm";

/** Record usage metric for a school tenant. */
export async function trackTenantUsage(tenantId: string, metric: string, quantity = 1): Promise<void> {
  const currentCycle = new Date().toISOString().slice(0, 7); // e.g. "2026-05"
  
  const [existing] = await db
    .select()
    .from(tenantBillingUsage)
    .where(
      and(
        eq(tenantBillingUsage.tenantId, tenantId),
        eq(tenantBillingUsage.metric, metric),
        eq(tenantBillingUsage.billingCycle, currentCycle)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(tenantBillingUsage)
      .set({
        quantityUsed: existing.quantityUsed + quantity,
        updatedAt: new Date(),
      })
      .where(eq(tenantBillingUsage.id, existing.id));
  } else {
    await db.insert(tenantBillingUsage).values({
      tenantId,
      metric,
      quantityUsed: quantity,
      billingCycle: currentCycle,
    });
  }
}

/** Check if tenant has exceeded their monthly usage limit. */
export async function getTenantUsageLimit(tenantId: string, metric: string): Promise<{ used: number; limit: number; exceeded: boolean }> {
  const currentCycle = new Date().toISOString().slice(0, 7);
  
  const [row] = await db
    .select({ quantityUsed: tenantBillingUsage.quantityUsed })
    .from(tenantBillingUsage)
    .where(
      and(
        eq(tenantBillingUsage.tenantId, tenantId),
        eq(tenantBillingUsage.metric, metric),
        eq(tenantBillingUsage.billingCycle, currentCycle)
      )
    )
    .limit(1);

  const used = row?.quantityUsed ?? 0;
  
  // Plan limits (generous defaults)
  const limits: Record<string, number> = {
    sms_volume: 1000,
    ai_credits: 50,
    storage_bytes: 10 * 1024 * 1024 * 1024, // 10 GB
  };

  const limit = limits[metric] ?? 999999;
  return {
    used,
    limit,
    exceeded: used >= limit,
  };
}
