import { db } from "../db";
import { platformAuditLogs, tenants, platformAdmins } from "../db/schema";
import { desc, eq, sql } from "drizzle-orm";

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

export async function listPlatformAuditLogs(opts: { limit?: number; tenantId?: string }) {
  const limit = Math.min(opts.limit ?? 100, 500);
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

/** Cross-tenant school audit + platform audit combined view. */
export async function listGlobalAuditFeed(limit = 80) {
  const school = await db.execute<{
    id: string; source: string; action: string; entity_type: string;
    tenant_id: string; tenant_name: string; actor: string; created_at: Date;
  }>(sql`
    SELECT a.id::text, 'school' AS source, a.action, a.entity_type,
      a.tenant_id::text, t.name AS tenant_name, u.email AS actor, a.created_at
    FROM audit_logs a
    INNER JOIN tenants t ON t.id = a.tenant_id
    LEFT JOIN users u ON u.id = a.actor_user_id
    ORDER BY a.created_at DESC
    LIMIT ${Math.floor(limit / 2)}
  `);

  const platform = await listPlatformAuditLogs({ limit: Math.floor(limit / 2) });

  const combined = [
    ...school.rows.map((r) => ({
      id: r.id,
      source: r.source,
      action: r.action,
      entityType: r.entity_type,
      tenantId: r.tenant_id,
      tenantName: r.tenant_name,
      actor: r.actor ?? "system",
      createdAt: r.created_at,
    })),
    ...platform.map((p) => ({
      id: p.id,
      source: "platform",
      action: p.action,
      entityType: p.entityType,
      tenantId: p.tenantId,
      tenantName: p.tenantName ?? "—",
      actor: p.adminEmail ?? "platform",
      createdAt: p.createdAt,
    })),
  ];
  combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return combined.slice(0, limit);
}
