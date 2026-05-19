import { db } from "../db";
import { auditLogs } from "../db/schema";

interface AuditParams {
  tenantId:    string;
  actorUserId?: string | null;
  action:      string;
  entityType:  string;
  entityId?:   string | null;
  before?:     unknown;
  after?:      unknown;
  ip?:         string | null;
}

export async function createAuditLog(params: AuditParams) {
  await db.insert(auditLogs).values({
    tenantId:    params.tenantId,
    actorUserId: params.actorUserId ?? undefined,
    action:      params.action,
    entityType:  params.entityType,
    entityId:    params.entityId ?? undefined,
    beforeJson:  params.before   ?? null,
    afterJson:   params.after    ?? null,
    ip:          params.ip       ?? undefined,
  });
}
