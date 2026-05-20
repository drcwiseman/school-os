import { db } from "../db";
import {
  platformAuditLogs, tenants, platformAdmins, auditLogs, users,
} from "../db/schema";
import { desc, eq, sql, and, ilike, gte } from "drizzle-orm";

export type AuditFeedRow = {
  id: string;
  source: "school" | "platform";
  action: string;
  entityType: string;
  entityId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
  actor: string | null;
  ip: string | null;
  createdAt: string;
  hasDiff: boolean;
};

export type PlatformAuditHub = {
  summary: {
    total: number;
    last24h: number;
    schoolEvents: number;
    platformEvents: number;
    schoolsWithActivity: number;
    uniqueActions: number;
    topActions: { action: string; count: number }[];
  };
  schools: { id: string; slug: string; name: string }[];
  events: AuditFeedRow[];
};

const HUB_MAX = 500;
const FEED_MAX = 500;

export async function createPlatformAuditLog(params: {
  platformAdminId?: string | null;
  tenantId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}) {
  await db.insert(platformAuditLogs).values({
    platformAdminId: params.platformAdminId ?? undefined,
    tenantId: params.tenantId ?? undefined,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? undefined,
    beforeJson: params.before ?? null,
    afterJson: params.after ?? null,
    ip: params.ip ?? undefined,
  });
}

/** Best-effort platform audit — never blocks the caller. */
export async function logPlatformAction(
  platformAdminId: string | null | undefined,
  action: string,
  opts: {
    tenantId?: string | null;
    entityType?: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
    ip?: string | null;
  } = {},
) {
  try {
    await createPlatformAuditLog({
      platformAdminId,
      tenantId: opts.tenantId,
      action,
      entityType: opts.entityType ?? "platform",
      entityId: opts.entityId,
      before: opts.before,
      after: opts.after,
      ip: opts.ip,
    });
  } catch (err) {
    console.warn("[platform-audit]", action, err);
  }
}

function toIso(d: Date | string | null | undefined): string {
  if (!d) return new Date(0).toISOString();
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function hasDiff(before: unknown, after: unknown): boolean {
  return before != null || after != null;
}

export async function listPlatformAuditLogs(opts: { limit?: number; tenantId?: string }) {
  const limit = Math.min(opts.limit ?? 100, FEED_MAX);
  const q = db
    .select({
      id: platformAuditLogs.id,
      action: platformAuditLogs.action,
      entityType: platformAuditLogs.entityType,
      entityId: platformAuditLogs.entityId,
      tenantId: platformAuditLogs.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      adminEmail: platformAdmins.email,
      ip: platformAuditLogs.ip,
      beforeJson: platformAuditLogs.beforeJson,
      afterJson: platformAuditLogs.afterJson,
      createdAt: platformAuditLogs.createdAt,
    })
    .from(platformAuditLogs)
    .leftJoin(tenants, eq(platformAuditLogs.tenantId, tenants.id))
    .leftJoin(platformAdmins, eq(platformAuditLogs.platformAdminId, platformAdmins.id))
    .orderBy(desc(platformAuditLogs.createdAt))
    .limit(limit);

  if (opts.tenantId) {
    return db
      .select({
        id: platformAuditLogs.id,
        action: platformAuditLogs.action,
        entityType: platformAuditLogs.entityType,
        entityId: platformAuditLogs.entityId,
        tenantId: platformAuditLogs.tenantId,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        adminEmail: platformAdmins.email,
        ip: platformAuditLogs.ip,
        beforeJson: platformAuditLogs.beforeJson,
        afterJson: platformAuditLogs.afterJson,
        createdAt: platformAuditLogs.createdAt,
      })
      .from(platformAuditLogs)
      .leftJoin(tenants, eq(platformAuditLogs.tenantId, tenants.id))
      .leftJoin(platformAdmins, eq(platformAuditLogs.platformAdminId, platformAdmins.id))
      .where(eq(platformAuditLogs.tenantId, opts.tenantId))
      .orderBy(desc(platformAuditLogs.createdAt))
      .limit(limit);
  }

  return q;
}

async function fetchSchoolAuditRows(opts: {
  limit: number;
  tenantId?: string;
  action?: string;
  since?: Date;
}) {
  const conditions = [];
  if (opts.tenantId) conditions.push(eq(auditLogs.tenantId, opts.tenantId));
  if (opts.action?.trim()) conditions.push(ilike(auditLogs.action, `%${opts.action.trim()}%`));
  if (opts.since) conditions.push(gte(auditLogs.createdAt, opts.since));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      tenantId: auditLogs.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      actorEmail: users.email,
      ip: auditLogs.ip,
      beforeJson: auditLogs.beforeJson,
      afterJson: auditLogs.afterJson,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(tenants, eq(auditLogs.tenantId, tenants.id))
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(opts.limit);

  return rows.map((r) => ({
    id: r.id,
    source: "school" as const,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    tenantId: r.tenantId,
    tenantName: r.tenantName,
    tenantSlug: r.tenantSlug,
    actor: r.actorEmail ?? "system",
    ip: r.ip,
    createdAt: toIso(r.createdAt),
    hasDiff: hasDiff(r.beforeJson, r.afterJson),
  }));
}

async function fetchPlatformAuditRows(opts: {
  limit: number;
  tenantId?: string;
  action?: string;
  since?: Date;
}) {
  const conditions = [];
  if (opts.tenantId) conditions.push(eq(platformAuditLogs.tenantId, opts.tenantId));
  if (opts.action?.trim()) conditions.push(ilike(platformAuditLogs.action, `%${opts.action.trim()}%`));
  if (opts.since) conditions.push(gte(platformAuditLogs.createdAt, opts.since));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: platformAuditLogs.id,
      action: platformAuditLogs.action,
      entityType: platformAuditLogs.entityType,
      entityId: platformAuditLogs.entityId,
      tenantId: platformAuditLogs.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      adminEmail: platformAdmins.email,
      ip: platformAuditLogs.ip,
      beforeJson: platformAuditLogs.beforeJson,
      afterJson: platformAuditLogs.afterJson,
      createdAt: platformAuditLogs.createdAt,
    })
    .from(platformAuditLogs)
    .leftJoin(tenants, eq(platformAuditLogs.tenantId, tenants.id))
    .leftJoin(platformAdmins, eq(platformAuditLogs.platformAdminId, platformAdmins.id))
    .where(where)
    .orderBy(desc(platformAuditLogs.createdAt))
    .limit(opts.limit);

  return rows.map((r) => ({
    id: r.id,
    source: "platform" as const,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    tenantId: r.tenantId,
    tenantName: r.tenantName,
    tenantSlug: r.tenantSlug,
    actor: r.adminEmail ?? "platform",
    ip: r.ip,
    createdAt: toIso(r.createdAt),
    hasDiff: hasDiff(r.beforeJson, r.afterJson),
  }));
}

function buildSummary(events: AuditFeedRow[]): PlatformAuditHub["summary"] {
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  const actionCounts = new Map<string, number>();
  const schoolIds = new Set<string>();

  let last24h = 0;
  let schoolEvents = 0;
  let platformEvents = 0;

  for (const e of events) {
    if (new Date(e.createdAt).getTime() >= cutoff24h) last24h += 1;
    if (e.source === "school") {
      schoolEvents += 1;
      if (e.tenantId) schoolIds.add(e.tenantId);
    } else {
      platformEvents += 1;
    }
    actionCounts.set(e.action, (actionCounts.get(e.action) ?? 0) + 1);
  }

  const topActions = [...actionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([action, count]) => ({ action, count }));

  return {
    total: events.length,
    last24h,
    schoolEvents,
    platformEvents,
    schoolsWithActivity: schoolIds.size,
    uniqueActions: actionCounts.size,
    topActions,
  };
}

export async function getPlatformAuditHub(opts: {
  source?: "all" | "school" | "platform";
  tenantId?: string;
  action?: string;
  days?: number;
  limit?: number;
}): Promise<PlatformAuditHub> {
  const source = opts.source ?? "all";
  const cap = Math.min(opts.limit ?? HUB_MAX, HUB_MAX);
  const since = opts.days && opts.days > 0
    ? new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000)
    : undefined;

  const perSource = source === "all" ? Math.ceil(cap / 2) : cap;

  const [schoolRows, platformRows, schools] = await Promise.all([
    source !== "platform"
      ? fetchSchoolAuditRows({ limit: perSource, tenantId: opts.tenantId, action: opts.action, since })
      : Promise.resolve([]),
    source !== "school"
      ? fetchPlatformAuditRows({ limit: perSource, tenantId: opts.tenantId, action: opts.action, since })
      : Promise.resolve([]),
    db.select({ id: tenants.id, slug: tenants.slug, name: tenants.name })
      .from(tenants)
      .orderBy(tenants.name),
  ]);

  const events = [...schoolRows, ...platformRows]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, cap);

  return {
    summary: buildSummary(events),
    schools,
    events,
  };
}

export async function getPlatformAuditEventDetail(
  source: "school" | "platform",
  id: string,
) {
  if (source === "school") {
    const [row] = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        tenantId: auditLogs.tenantId,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        actorEmail: users.email,
        actorUserId: auditLogs.actorUserId,
        ip: auditLogs.ip,
        beforeJson: auditLogs.beforeJson,
        afterJson: auditLogs.afterJson,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(tenants, eq(auditLogs.tenantId, tenants.id))
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(eq(auditLogs.id, id))
      .limit(1);
    if (!row) return null;
    return {
      source: "school" as const,
      ...row,
      actor: row.actorEmail ?? row.actorUserId ?? "system",
      createdAt: toIso(row.createdAt),
    };
  }

  const [row] = await db
    .select({
      id: platformAuditLogs.id,
      action: platformAuditLogs.action,
      entityType: platformAuditLogs.entityType,
      entityId: platformAuditLogs.entityId,
      tenantId: platformAuditLogs.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      adminEmail: platformAdmins.email,
      platformAdminId: platformAuditLogs.platformAdminId,
      ip: platformAuditLogs.ip,
      beforeJson: platformAuditLogs.beforeJson,
      afterJson: platformAuditLogs.afterJson,
      createdAt: platformAuditLogs.createdAt,
    })
    .from(platformAuditLogs)
    .leftJoin(tenants, eq(platformAuditLogs.tenantId, tenants.id))
    .leftJoin(platformAdmins, eq(platformAuditLogs.platformAdminId, platformAdmins.id))
    .where(eq(platformAuditLogs.id, id))
    .limit(1);
  if (!row) return null;
  return {
    source: "platform" as const,
    ...row,
    actor: row.adminEmail ?? row.platformAdminId ?? "platform",
    createdAt: toIso(row.createdAt),
  };
}

/** Cross-tenant school audit + platform audit combined view (dashboard feed). */
export async function listGlobalAuditFeed(limit = 80): Promise<AuditFeedRow[]> {
  const cap = Math.min(limit, FEED_MAX);
  const hub = await getPlatformAuditHub({ limit: cap });
  return hub.events;
}
