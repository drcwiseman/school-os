import { Router } from "express";
import { db } from "../db";
import {
  students, invoices, applicants, attendanceSessions, auditLogs, users,
} from "../db/schema";
import { eq, and, sql, isNull, desc, gte, lt } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/", ...guard, requirePermission("students.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [studentStats] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${students.status} = 'active')`,
      })
      .from(students)
      .where(and(eq(students.tenantId, tenant.id), isNull(students.deletedAt)));

    const [unpaid] = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenant.id),
        isNull(invoices.deletedAt),
        sql`${invoices.paidAmount} < ${invoices.totalAmount}`,
      ));

    const [pipeline] = await db
      .select({ count: sql<number>`count(*)` })
      .from(applicants)
      .where(and(
        eq(applicants.tenantId, tenant.id),
        isNull(applicants.convertedTo),
      ));

    const [todaySessions] = await db
      .select({ count: sql<number>`count(*)` })
      .from(attendanceSessions)
      .where(and(
        eq(attendanceSessions.tenantId, tenant.id),
        gte(attendanceSessions.date, startOfDay),
        lt(attendanceSessions.date, endOfDay),
      ));

    const recentActivity = await db
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

    res.json({
      success: true,
      data: {
        totalStudents: Number(studentStats?.total ?? 0),
        activeStudents: Number(studentStats?.active ?? 0),
        unpaidInvoices: Number(unpaid?.count ?? 0),
        applicantsInPipeline: Number(pipeline?.count ?? 0),
        todayAttendanceSessions: Number(todaySessions?.count ?? 0),
        recentActivity,
      },
    });
  } catch (e) { next(e); }
});

export default router;
