import { db } from "../db";
import {
  platformPayouts, tenants, tenantSettings,
} from "../db/schema";
import { eq, sql, desc, inArray } from "drizzle-orm";
import { NotFoundError, BadRequestError } from "../middleware/error";
import { getPlatformDefaults } from "./platform-settings";
import { convertMinor } from "./currency-exchange";
import { listPlatformTenants } from "./platform-tenants-list";

export type PayoutStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

const RESERVED_STATUSES: PayoutStatus[] = ["pending", "processing", "completed"];

export type SchoolPayoutBalance = {
  tenantId: string;
  slug: string;
  name: string;
  status: string;
  currency: string;
  collectedMinor: number;
  paidOutMinor: number;
  availableMinor: number;
  collectedDisplayMinor: number;
  paidOutDisplayMinor: number;
  availableDisplayMinor: number;
  lastPayoutAt: string | null;
};

export type PlatformPayoutRow = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  amount: number;
  currency: string;
  amountDisplayMinor: number;
  status: PayoutStatus;
  reference: string | null;
  note: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type PlatformPayoutsLedger = {
  displayCurrency: string;
  fxProvider: string;
  summary: {
    totalCollected: number;
    totalPaidOut: number;
    totalAvailable: number;
    pendingPayouts: number;
    completedPayouts: number;
    schoolsWithBalance: number;
  };
  schools: SchoolPayoutBalance[];
  payouts: PlatformPayoutRow[];
};

async function paymentTotalsByTenant(): Promise<Map<string, { total: number; currency: string }>> {
  const agg = await db.execute<{ tenant_id: string; currency: string; total: string }>(sql`
    SELECT p.tenant_id,
      COALESCE(MAX(ts.currency), 'USD') AS currency,
      SUM(p.amount)::text AS total
    FROM payments p
    LEFT JOIN tenant_settings ts ON ts.tenant_id = p.tenant_id
    WHERE p.deleted_at IS NULL
    GROUP BY p.tenant_id
  `);
  const map = new Map<string, { total: number; currency: string }>();
  for (const row of agg.rows) {
    map.set(row.tenant_id, {
      total: Number(row.total ?? 0),
      currency: (row.currency ?? "USD").toUpperCase(),
    });
  }
  return map;
}

async function payoutTotalsByTenant(): Promise<Map<string, { total: number; lastAt: Date | null }>> {
  const rows = await db
    .select({
      tenantId: platformPayouts.tenantId,
      amount: platformPayouts.amount,
      status: platformPayouts.status,
      completedAt: platformPayouts.completedAt,
      createdAt: platformPayouts.createdAt,
    })
    .from(platformPayouts)
    .where(inArray(platformPayouts.status, RESERVED_STATUSES));

  const map = new Map<string, { total: number; lastAt: Date | null }>();
  for (const r of rows) {
    const cur = map.get(r.tenantId) ?? { total: 0, lastAt: null };
    cur.total += r.amount;
    const at = r.completedAt ?? r.createdAt;
    if (!cur.lastAt || at > cur.lastAt) cur.lastAt = at;
    map.set(r.tenantId, cur);
  }
  return map;
}

export async function getPlatformPayoutsLedger(): Promise<PlatformPayoutsLedger> {
  const defaults = await getPlatformDefaults();
  const displayCurrency = defaults.displayCurrency;

  const tenantsList = await listPlatformTenants();
  const collectedMap = await paymentTotalsByTenant();
  const paidMap = await payoutTotalsByTenant();

  const schools: SchoolPayoutBalance[] = [];
  let totalCollected = 0;
  let totalPaidOut = 0;
  let schoolsWithBalance = 0;

  for (const t of tenantsList) {
    const col = collectedMap.get(t.id);
    const cur = (col?.currency ?? t.currency ?? "USD").toUpperCase();
    const collectedMinor = col?.total ?? 0;
    const paidOutMinor = paidMap.get(t.id)?.total ?? 0;
    const availableMinor = Math.max(0, collectedMinor - paidOutMinor);

    const collectedDisplayMinor = collectedMinor > 0
      ? await convertMinor(collectedMinor, cur, displayCurrency)
      : 0;
    const paidOutDisplayMinor = paidOutMinor > 0
      ? await convertMinor(paidOutMinor, cur, displayCurrency)
      : 0;
    const availableDisplayMinor = availableMinor > 0
      ? await convertMinor(availableMinor, cur, displayCurrency)
      : 0;

    totalCollected += collectedDisplayMinor;
    totalPaidOut += paidOutDisplayMinor;
    if (availableMinor > 0) schoolsWithBalance += 1;

    schools.push({
      tenantId: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      currency: cur,
      collectedMinor,
      paidOutMinor,
      availableMinor,
      collectedDisplayMinor,
      paidOutDisplayMinor,
      availableDisplayMinor,
      lastPayoutAt: paidMap.get(t.id)?.lastAt?.toISOString() ?? null,
    });
  }

  schools.sort((a, b) => b.availableDisplayMinor - a.availableDisplayMinor);

  const payoutRows = await db
    .select({
      id: platformPayouts.id,
      tenantId: platformPayouts.tenantId,
      amount: platformPayouts.amount,
      currency: platformPayouts.currency,
      status: platformPayouts.status,
      reference: platformPayouts.reference,
      note: platformPayouts.note,
      periodFrom: platformPayouts.periodFrom,
      periodTo: platformPayouts.periodTo,
      completedAt: platformPayouts.completedAt,
      createdAt: platformPayouts.createdAt,
      slug: tenants.slug,
      name: tenants.name,
    })
    .from(platformPayouts)
    .innerJoin(tenants, eq(tenants.id, platformPayouts.tenantId))
    .orderBy(desc(platformPayouts.createdAt))
    .limit(200);

  let pendingPayouts = 0;
  let completedPayouts = 0;
  const payouts: PlatformPayoutRow[] = [];

  for (const p of payoutRows) {
    const cur = p.currency.toUpperCase();
    const displayAmt = await convertMinor(p.amount, cur, displayCurrency);
    if (p.status === "pending" || p.status === "processing") pendingPayouts += displayAmt;
    if (p.status === "completed") completedPayouts += displayAmt;

    payouts.push({
      id: p.id,
      tenantId: p.tenantId,
      tenantSlug: p.slug,
      tenantName: p.name,
      amount: p.amount,
      currency: cur,
      amountDisplayMinor: displayAmt,
      status: p.status as PayoutStatus,
      reference: p.reference,
      note: p.note,
      periodFrom: p.periodFrom ? p.periodFrom.toISOString() : null,
      periodTo: p.periodTo ? p.periodTo.toISOString() : null,
      completedAt: p.completedAt ? p.completedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    });
  }

  return {
    displayCurrency,
    fxProvider: "frankfurter.app + fallbacks",
    summary: {
      totalCollected,
      totalPaidOut,
      totalAvailable: Math.max(0, totalCollected - totalPaidOut),
      pendingPayouts,
      completedPayouts,
      schoolsWithBalance,
    },
    schools,
    payouts,
  };
}

export async function getSchoolAvailableMinor(tenantId: string): Promise<{ available: number; currency: string }> {
  const collectedMap = await paymentTotalsByTenant();
  const paidMap = await payoutTotalsByTenant();
  const col = collectedMap.get(tenantId);
  const [ts] = await db.select({ currency: tenantSettings.currency }).from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId)).limit(1);
  const currency = (col?.currency ?? ts?.currency ?? "USD").toUpperCase();
  const collected = col?.total ?? 0;
  const paid = paidMap.get(tenantId)?.total ?? 0;
  return { available: Math.max(0, collected - paid), currency };
}

export async function createPlatformPayout(opts: {
  tenantSlug: string;
  amount: number;
  reference?: string;
  note?: string;
  status?: PayoutStatus;
  createdById?: string;
}) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, opts.tenantSlug)).limit(1);
  if (!tenant) throw new NotFoundError("School not found");
  if (opts.amount <= 0) throw new BadRequestError("Amount must be positive");

  const { available, currency } = await getSchoolAvailableMinor(tenant.id);
  if (opts.amount > available) {
    throw new BadRequestError(`Amount exceeds available balance (${available} minor units)`);
  }

  const status: PayoutStatus = opts.status ?? "completed";
  const completedAt = status === "completed" ? new Date() : null;

  const [row] = await db.insert(platformPayouts).values({
    tenantId: tenant.id,
    amount: opts.amount,
    currency,
    status,
    reference: opts.reference ?? null,
    note: opts.note ?? null,
    createdBy: opts.createdById ?? null,
    completedAt,
    updatedAt: new Date(),
  }).returning();

  return row;
}

export async function updatePlatformPayoutStatus(
  payoutId: string,
  status: PayoutStatus,
) {
  const [existing] = await db.select().from(platformPayouts).where(eq(platformPayouts.id, payoutId)).limit(1);
  if (!existing) throw new NotFoundError("Payout not found");

  if (status === "cancelled" || status === "failed") {
    // releasing reserved funds — ok
  } else if (RESERVED_STATUSES.includes(status) && !RESERVED_STATUSES.includes(existing.status as PayoutStatus)) {
    const { available } = await getSchoolAvailableMinor(existing.tenantId);
    if (existing.amount > available) {
      throw new BadRequestError("Insufficient available balance for this status change");
    }
  }

  const completedAt = status === "completed"
    ? (existing.completedAt ?? new Date())
    : status === "cancelled" || status === "failed"
      ? null
      : existing.completedAt;

  const [row] = await db.update(platformPayouts).set({
    status,
    completedAt,
    updatedAt: new Date(),
  }).where(eq(platformPayouts.id, payoutId)).returning();

  return row;
}
