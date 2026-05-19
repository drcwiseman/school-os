import { db } from "../db";
import { tenantCounters } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function nextReceiptNumber(tenantId: string): Promise<string> {
  const key = "receipt_seq";
  const [row] = await db.select().from(tenantCounters)
    .where(and(eq(tenantCounters.tenantId, tenantId), eq(tenantCounters.key, key))).limit(1);

  if (!row) {
    await db.insert(tenantCounters).values({ tenantId, key, value: 1 });
    return "RCP-000001";
  }

  const next = row.value + 1;
  await db.update(tenantCounters).set({ value: next })
    .where(and(eq(tenantCounters.tenantId, tenantId), eq(tenantCounters.key, key)));
  return `RCP-${String(next).padStart(6, "0")}`;
}
