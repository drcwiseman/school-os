import { Router } from "express";
import { db } from "../db";
import { auditLogs, users } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { getUserPermissions } from "../middleware/rbac";
import { buildCommandCenterKpis, type CommandCenterKpis } from "../services/command-center";
import { getCampusId } from "../lib/campus-scope";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

function filterKpisByPermission(kpis: CommandCenterKpis, can: (code: string) => boolean): Partial<CommandCenterKpis> & { recentActivity?: unknown[] } {
  const out: Partial<CommandCenterKpis> & { recentActivity?: unknown[] } = {};
  if (can("students.view") || can("attendance.view") || can("academics.view") || can("exams.view")) {
    out.academic = kpis.academic;
  }
  if (can("finance.view") || can("payroll.view")) {
    out.finance = kpis.finance;
  }
  if (can("library.view") || can("transport.view") || can("boarding.view") || can("health.view") || can("inventory.view")) {
    out.operations = kpis.operations;
  }
  if (can("messaging.view")) {
    out.communication = kpis.communication;
  }
  if (can("students.view") || can("finance.view") || can("attendance.view")) {
    out.aiInsights = kpis.aiInsights;
  }
  return out;
}

router.get("/", ...guard, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const perms = await getUserPermissions(user.id, tenant.id);
    const can = (code: string) => perms.includes(code);

    const kpis = await buildCommandCenterKpis(tenant.id, getCampusId(req));
    const data = filterKpisByPermission(kpis, can);

    if (can("audit.view")) {
      data.recentActivity = await db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          createdAt: auditLogs.createdAt,
          actorEmail: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorUserId, users.id))
        .where(eq(auditLogs.tenantId, tenant.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(8);
    } else {
      data.recentActivity = [];
    }

    res.json({ success: true, data });
  } catch (e) { next(e); }
});

export default router;
