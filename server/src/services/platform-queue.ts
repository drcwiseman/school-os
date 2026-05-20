import { db } from "../db";
import { jobs, tenants } from "../db/schema";
import { desc, eq, and, gte, ilike, sql } from "drizzle-orm";
import { NotFoundError, BadRequestError } from "../middleware/error";
import { retryJob, tick as processQueue } from "./queue";

export const JOB_STATUSES = ["pending", "running", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type QueueJobRow = {
  id: string;
  type: string;
  status: JobStatus;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
  hasDetail: boolean;
};

export type PlatformQueueHub = {
  workerActive: boolean;
  pollIntervalSec: number;
  summary: {
    total: number;
    pending: number;
    running: number;
    done: number;
    failed: number;
    last24h: number;
    byType: Record<string, number>;
  };
  schools: { id: string; slug: string; name: string }[];
  jobs: QueueJobRow[];
};

const HUB_MAX = 500;

function toIso(d: Date | string | null | undefined): string {
  if (!d) return new Date(0).toISOString();
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function durationMs(created: Date, updated: Date): number | null {
  const ms = updated.getTime() - created.getTime();
  return ms >= 0 ? ms : null;
}

export async function getPlatformQueueHub(opts: {
  status?: string;
  type?: string;
  tenantId?: string;
  days?: number;
  limit?: number;
}): Promise<PlatformQueueHub> {
  const cap = Math.min(opts.limit ?? HUB_MAX, HUB_MAX);
  const since = opts.days && opts.days > 0
    ? new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000)
    : undefined;

  const conditions = [];
  if (opts.tenantId) conditions.push(eq(jobs.tenantId, opts.tenantId));
  if (opts.status && opts.status !== "all") {
    conditions.push(eq(jobs.status, opts.status as JobStatus));
  }
  if (opts.type?.trim()) conditions.push(ilike(jobs.type, `%${opts.type.trim()}%`));
  if (since) conditions.push(gte(jobs.createdAt, since));

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, schools, statusAgg, typeAgg] = await Promise.all([
    db
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
      .orderBy(desc(jobs.updatedAt))
      .limit(cap),
    db.select({ id: tenants.id, slug: tenants.slug, name: tenants.name }).from(tenants).orderBy(tenants.name),
    db.execute<{ status: string; n: string }>(sql`
      SELECT status, count(*)::text AS n FROM jobs GROUP BY status
    `),
    db.execute<{ type: string; n: string }>(sql`
      SELECT type, count(*)::text AS n FROM jobs GROUP BY type ORDER BY count(*) DESC LIMIT 12
    `),
  ]);

  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  let last24h = 0;
  const byType: Record<string, number> = {};
  for (const row of typeAgg.rows) {
    byType[row.type] = Number(row.n ?? 0);
  }

  for (const r of rows) {
    if (new Date(r.updatedAt).getTime() >= cutoff24h) last24h += 1;
  }

  const statusTotals = { pending: 0, running: 0, done: 0, failed: 0 };
  for (const row of statusAgg.rows) {
    const n = Number(row.n ?? 0);
    if (row.status === "pending") statusTotals.pending = n;
    else if (row.status === "running") statusTotals.running = n;
    else if (row.status === "done") statusTotals.done = n;
    else if (row.status === "failed") statusTotals.failed = n;
  }

  const jobList: QueueJobRow[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status as JobStatus,
    tenantId: r.tenantId,
    tenantName: r.tenantName,
    tenantSlug: r.tenantSlug,
    error: r.error,
    durationMs: durationMs(r.createdAt, r.updatedAt),
    createdAt: toIso(r.createdAt),
    updatedAt: toIso(r.updatedAt),
    hasDetail: r.payload != null || r.result != null || r.error != null,
  }));

  return {
    workerActive: true,
    pollIntervalSec: 5,
    summary: {
      total: statusTotals.pending + statusTotals.running + statusTotals.done + statusTotals.failed,
      pending: statusTotals.pending,
      running: statusTotals.running,
      done: statusTotals.done,
      failed: statusTotals.failed,
      last24h,
      byType,
    },
    schools,
    jobs: jobList,
  };
}

export async function getPlatformQueueJobDetail(id: string) {
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

  if (!row) throw new NotFoundError("Job not found");

  return {
    ...row,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    durationMs: durationMs(row.createdAt, row.updatedAt),
  };
}

export async function retryPlatformJob(id: string) {
  const detail = await retryJob(id);
  return getPlatformQueueJobDetail(detail.id);
}

export async function triggerQueueProcessing() {
  await processQueue();
  return { triggered: true };
}
