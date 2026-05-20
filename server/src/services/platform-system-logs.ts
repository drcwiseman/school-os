import { db } from "../db";
import { jobs, deliveryLogs, tenants } from "../db/schema";
import { desc, eq, and, gte } from "drizzle-orm";

export type SystemLogRow = {
  id: string;
  source: "job" | "delivery";
  status: string;
  level: "info" | "warn" | "error";
  message: string;
  subtext: string | null;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
  createdAt: string;
  updatedAt: string | null;
  hasDetail: boolean;
};

export type PlatformSystemLogsHub = {
  summary: {
    total: number;
    last24h: number;
    jobsTotal: number;
    jobsPending: number;
    jobsRunning: number;
    jobsFailed: number;
    jobsDone: number;
    deliveriesTotal: number;
    deliveriesFailed: number;
    schoolsWithActivity: number;
  };
  schools: { id: string; slug: string; name: string }[];
  events: SystemLogRow[];
};

const HUB_MAX = 500;

function toIso(d: Date | string | null | undefined): string {
  if (!d) return new Date(0).toISOString();
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function jobLevel(status: string): SystemLogRow["level"] {
  if (status === "failed") return "error";
  if (status === "pending" || status === "running") return "warn";
  return "info";
}

function deliveryLevel(status: string): SystemLogRow["level"] {
  const s = status.toLowerCase();
  if (s === "failed" || s === "error" || s === "bounced") return "error";
  if (s === "pending" || s === "queued") return "warn";
  return "info";
}

async function fetchJobRows(opts: {
  limit: number;
  tenantId?: string;
  status?: string;
  since?: Date;
}) {
  const conditions = [];
  if (opts.tenantId) conditions.push(eq(jobs.tenantId, opts.tenantId));
  if (opts.status && opts.status !== "all") {
    conditions.push(eq(jobs.status, opts.status as "pending" | "running" | "done" | "failed"));
  }
  if (opts.since) conditions.push(gte(jobs.createdAt, opts.since));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: jobs.id,
      type: jobs.type,
      status: jobs.status,
      error: jobs.error,
      payload: jobs.payload,
      result: jobs.result,
      tenantId: jobs.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .leftJoin(tenants, eq(jobs.tenantId, tenants.id))
    .where(where)
    .orderBy(desc(jobs.createdAt))
    .limit(opts.limit);

  return rows.map((r) => ({
    id: r.id,
    source: "job" as const,
    status: r.status,
    level: jobLevel(r.status),
    message: r.type,
    subtext: r.error ?? (r.status === "done" ? "Completed" : null),
    tenantId: r.tenantId,
    tenantName: r.tenantName,
    tenantSlug: r.tenantSlug,
    createdAt: toIso(r.createdAt),
    updatedAt: toIso(r.updatedAt),
    hasDetail: r.payload != null || r.result != null || r.error != null,
  }));
}

async function fetchDeliveryRows(opts: {
  limit: number;
  tenantId?: string;
  status?: string;
  since?: Date;
}) {
  const conditions = [];
  if (opts.tenantId) conditions.push(eq(deliveryLogs.tenantId, opts.tenantId));
  if (opts.status && opts.status !== "all") {
    conditions.push(eq(deliveryLogs.status, opts.status));
  }
  if (opts.since) conditions.push(gte(deliveryLogs.createdAt, opts.since));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: deliveryLogs.id,
      channel: deliveryLogs.channel,
      status: deliveryLogs.status,
      recipient: deliveryLogs.recipient,
      error: deliveryLogs.error,
      providerRef: deliveryLogs.providerRef,
      campaignId: deliveryLogs.campaignId,
      announcementId: deliveryLogs.announcementId,
      tenantId: deliveryLogs.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      createdAt: deliveryLogs.createdAt,
    })
    .from(deliveryLogs)
    .leftJoin(tenants, eq(deliveryLogs.tenantId, tenants.id))
    .where(where)
    .orderBy(desc(deliveryLogs.createdAt))
    .limit(opts.limit);

  return rows.map((r) => ({
    id: r.id,
    source: "delivery" as const,
    status: r.status,
    level: deliveryLevel(r.status),
    message: `${r.channel} → ${r.recipient}`,
    subtext: r.error ?? r.providerRef,
    tenantId: r.tenantId,
    tenantName: r.tenantName,
    tenantSlug: r.tenantSlug,
    createdAt: toIso(r.createdAt),
    updatedAt: null,
    hasDetail: true,
  }));
}

function buildSummary(events: SystemLogRow[]): PlatformSystemLogsHub["summary"] {
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  const schoolIds = new Set<string>();
  let last24h = 0;
  let jobsTotal = 0;
  let jobsPending = 0;
  let jobsRunning = 0;
  let jobsFailed = 0;
  let jobsDone = 0;
  let deliveriesTotal = 0;
  let deliveriesFailed = 0;

  for (const e of events) {
    if (new Date(e.createdAt).getTime() >= cutoff24h) last24h += 1;
    if (e.tenantId) schoolIds.add(e.tenantId);
    if (e.source === "job") {
      jobsTotal += 1;
      if (e.status === "pending") jobsPending += 1;
      else if (e.status === "running") jobsRunning += 1;
      else if (e.status === "failed") jobsFailed += 1;
      else if (e.status === "done") jobsDone += 1;
    } else {
      deliveriesTotal += 1;
      if (deliveryLevel(e.status) === "error") deliveriesFailed += 1;
    }
  }

  return {
    total: events.length,
    last24h,
    jobsTotal,
    jobsPending,
    jobsRunning,
    jobsFailed,
    jobsDone,
    deliveriesTotal,
    deliveriesFailed,
    schoolsWithActivity: schoolIds.size,
  };
}

export async function getPlatformSystemLogsHub(opts: {
  source?: "all" | "job" | "delivery";
  tenantId?: string;
  status?: string;
  days?: number;
  limit?: number;
}): Promise<PlatformSystemLogsHub> {
  const source = opts.source ?? "all";
  const cap = Math.min(opts.limit ?? HUB_MAX, HUB_MAX);
  const since = opts.days && opts.days > 0
    ? new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000)
    : undefined;
  const perSource = source === "all" ? Math.ceil(cap / 2) : cap;

  const [jobEvents, deliveryEvents, schools] = await Promise.all([
    source !== "delivery"
      ? fetchJobRows({ limit: perSource, tenantId: opts.tenantId, status: opts.status, since })
      : Promise.resolve([]),
    source !== "job"
      ? fetchDeliveryRows({ limit: perSource, tenantId: opts.tenantId, status: opts.status, since })
      : Promise.resolve([]),
    db.select({ id: tenants.id, slug: tenants.slug, name: tenants.name })
      .from(tenants)
      .orderBy(tenants.name),
  ]);

  const events = [...jobEvents, ...deliveryEvents]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, cap);

  return {
    summary: buildSummary(events),
    schools,
    events,
  };
}

export async function getPlatformJobLogDetail(id: string) {
  const [row] = await db
    .select({
      id: jobs.id,
      type: jobs.type,
      status: jobs.status,
      error: jobs.error,
      payload: jobs.payload,
      result: jobs.result,
      tenantId: jobs.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .leftJoin(tenants, eq(jobs.tenantId, tenants.id))
    .where(eq(jobs.id, id))
    .limit(1);
  if (!row) return null;
  return {
    source: "job" as const,
    ...row,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export async function getPlatformDeliveryLogDetail(id: string) {
  const [row] = await db
    .select({
      id: deliveryLogs.id,
      channel: deliveryLogs.channel,
      status: deliveryLogs.status,
      recipient: deliveryLogs.recipient,
      error: deliveryLogs.error,
      providerRef: deliveryLogs.providerRef,
      campaignId: deliveryLogs.campaignId,
      announcementId: deliveryLogs.announcementId,
      tenantId: deliveryLogs.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      createdAt: deliveryLogs.createdAt,
    })
    .from(deliveryLogs)
    .leftJoin(tenants, eq(deliveryLogs.tenantId, tenants.id))
    .where(eq(deliveryLogs.id, id))
    .limit(1);
  if (!row) return null;
  return {
    source: "delivery" as const,
    ...row,
    createdAt: toIso(row.createdAt),
  };
}
