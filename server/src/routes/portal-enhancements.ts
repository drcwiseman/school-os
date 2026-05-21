import { Router } from "express";
import { db } from "../db";
import {
  students, invoices, reportCards, attendanceRecords, attendanceSessions,
  announcements, assignments, assignmentSubmissions, studentLeaveRequests,
} from "../db/schema";
import { requirePortalAuth } from "../middleware/portal-auth";
import { filterStudentsForPortal } from "../services/portal-access";
import { eq, and, desc, isNull, inArray, sql } from "drizzle-orm";
import { promoteScheduledAnnouncements } from "../services/announcements";

export const portalEnhancementsRouter = Router();
portalEnhancementsRouter.use(requirePortalAuth);

portalEnhancementsRouter.get("/dashboard/summary", async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;

    if (principal.kind === "parent") {
      const children = await filterStudentsForPortal(principal, tenant.id);
      const studentIds = children.map((c) => c.id);
      let feeDue = 0;
      let feePaid = 0;
      let unpaidInvoices = 0;
      if (studentIds.length) {
        const invs = await db.select().from(invoices).where(and(
          eq(invoices.tenantId, tenant.id),
          inArray(invoices.studentId, studentIds),
          isNull(invoices.deletedAt),
        ));
        for (const i of invs) {
          feeDue += Math.max(0, i.totalAmount - i.paidAmount);
          feePaid += i.paidAmount;
          if (i.paidAmount < i.totalAmount) unpaidInvoices++;
        }
      }
      const attendanceStats = studentIds.length ? await db.select({
        present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')`,
        absent: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'absent')`,
      }).from(attendanceRecords)
        .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
        .where(and(eq(attendanceRecords.tenantId, tenant.id), inArray(attendanceRecords.studentId, studentIds)))
        : [{ present: 0, absent: 0 }];

      const reportCount = studentIds.length
        ? (await db.select({ n: sql<number>`count(*)` }).from(reportCards).where(and(
          eq(reportCards.tenantId, tenant.id), inArray(reportCards.studentId, studentIds), eq(reportCards.published, true),
        )))[0]?.n ?? 0
        : 0;

      await promoteScheduledAnnouncements(tenant.id);
      const noticeCount = (await db.select({ n: sql<number>`count(*)` }).from(announcements).where(and(
        eq(announcements.tenantId, tenant.id), eq(announcements.published, true),
      )))[0]?.n ?? 0;

      return res.json({
        success: true,
        data: {
          type: "parent",
          childCount: children.length,
          feeDueMinor: feeDue,
          feePaidMinor: feePaid,
          unpaidInvoices,
          attendancePresent: Number(attendanceStats[0]?.present ?? 0),
          attendanceAbsent: Number(attendanceStats[0]?.absent ?? 0),
          publishedReportCards: Number(reportCount),
          noticeboardCount: Number(noticeCount),
          children: children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, admissionNumber: c.admissionNumber })),
        },
      });
    }

    const studentId = principal.account.studentId;
    const [student] = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.tenantId, tenant.id))).limit(1);
    const invs = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenant.id), eq(invoices.studentId, studentId), isNull(invoices.deletedAt)));
    let feeDue = 0;
    for (const i of invs) feeDue += Math.max(0, i.totalAmount - i.paidAmount);

    const [att] = await db.select({
      present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')`,
      absent: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'absent')`,
    }).from(attendanceRecords)
      .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
      .where(and(eq(attendanceRecords.tenantId, tenant.id), eq(attendanceRecords.studentId, studentId)));

    const pendingHw = await db.select({ n: sql<number>`count(*)` }).from(assignments)
      .where(eq(assignments.tenantId, tenant.id));
    const submitted = await db.select({ n: sql<number>`count(*)` }).from(assignmentSubmissions)
      .where(and(eq(assignmentSubmissions.tenantId, tenant.id), eq(assignmentSubmissions.studentId, studentId)));

    const [rc] = await db.select().from(reportCards).where(and(
      eq(reportCards.studentId, studentId), eq(reportCards.tenantId, tenant.id), eq(reportCards.published, true),
    )).orderBy(desc(reportCards.createdAt)).limit(1);

    const leaves = await db.select().from(studentLeaveRequests).where(and(
      eq(studentLeaveRequests.studentId, studentId), eq(studentLeaveRequests.tenantId, tenant.id),
    ));

    res.json({
      success: true,
      data: {
        type: "student",
        student: student ? { id: student.id, firstName: student.firstName, lastName: student.lastName, admissionNumber: student.admissionNumber } : null,
        feeDueMinor: feeDue,
        attendancePresent: Number(att?.present ?? 0),
        attendanceAbsent: Number(att?.absent ?? 0),
        assignmentsTotal: Number(pendingHw[0]?.n ?? 0),
        submissionsCount: Number(submitted[0]?.n ?? 0),
        latestReportCard: rc ?? null,
        pendingLeaves: leaves.filter((l) => l.status === "pending").length,
      },
    });
  } catch (e) { next(e); }
});

export default portalEnhancementsRouter;
