import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  parentAccounts, studentAccounts, students, invoices, payments, receipts,
  reportCards, announcements, assignments, attendanceRecords, attendanceSessions,
} from "../db/schema";
import { generateReportCardPdf, generateReceiptPdf } from "../services/pdf";
import { assertPortalCanAccessStudent } from "../services/portal-access";
import { eq, and, desc, inArray, isNull } from "drizzle-orm";
import {
  requirePortalAuth,
  createParentSession,
  createStudentSession,
  verifyPassword,
  deletePortalSession,
} from "../middleware/portal-auth";
import { validate } from "../utils/validate";
import { UnauthorizedError, NotFoundError } from "../middleware/error";
import { filterStudentsForPortal } from "../services/portal-access";
import { getTenantFeatureFlags } from "../services/tenant-features";
import { isFeatureAllowedForTenant } from "../services/plan-features";
import { ForbiddenError } from "../middleware/error";

const router = Router();

function sendPdf(res: any, bytes: Uint8Array, filename: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(bytes));
}

router.post("/login", validate({ body: z.object({ email: z.string().email(), password: z.string() }) }), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const portalAllowed = await isFeatureAllowedForTenant(tenant.id, "portal_enabled");
    if (!portalAllowed) throw new ForbiddenError("Parent/student portal is not enabled for this school");

    const [parent] = await db.select().from(parentAccounts)
      .where(and(eq(parentAccounts.tenantId, tenant.id), eq(parentAccounts.email, req.body.email))).limit(1);

    if (parent) {
      if (parent.status !== "active") throw new UnauthorizedError("Account is not active");
      const valid = await verifyPassword(req.body.password, parent.passwordHash);
      if (!valid) throw new UnauthorizedError("Invalid credentials");
      const session = await createParentSession(parent.id, tenant.id);
      res.cookie("portal_session_token", session.token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
      return res.json({ success: true, account: { id: parent.id, email: parent.email, type: "parent" } });
    }

    const [student] = await db.select().from(studentAccounts)
      .where(and(eq(studentAccounts.tenantId, tenant.id), eq(studentAccounts.email, req.body.email))).limit(1);

    if (student) {
      if (student.status !== "active") throw new UnauthorizedError("Account is not active");
      const valid = await verifyPassword(req.body.password, student.passwordHash);
      if (!valid) throw new UnauthorizedError("Invalid credentials");
      const session = await createStudentSession(student.id, tenant.id);
      res.cookie("portal_session_token", session.token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
      return res.json({ success: true, account: { id: student.id, email: student.email, type: "student" } });
    }

    throw new UnauthorizedError("Invalid credentials");
  } catch (e) { next(e); }
});

router.post("/logout", requirePortalAuth, async (req, res) => {
  const token = req.cookies?.portal_session_token;
  if (token) await deletePortalSession(token);
  res.clearCookie("portal_session_token");
  res.json({ success: true });
});

router.get("/me", requirePortalAuth, async (req, res, next) => {
  try {
    const principal = (req as any).portalPrincipal;
    res.json({
      success: true,
      account: {
        id: principal.account.id,
        email: principal.account.email,
        type: principal.kind,
      },
    });
  } catch (e) { next(e); }
});

router.get("/dashboard", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    const flags = await getTenantFeatureFlags(tenant.id);
    const resultsVisible = flags.results_visible !== false;
    const feesMustBeClear = flags.fees_must_be_clear === true;

    if (principal.kind === "parent") {
      const children = await filterStudentsForPortal(principal, tenant.id);
      const studentIds = children.map((c) => c.id);
      let statements: typeof invoices.$inferSelect[] = [];
      if (studentIds.length) {
        statements = await db.select().from(invoices).where(and(
          eq(invoices.tenantId, tenant.id),
          inArray(invoices.studentId, studentIds),
          isNull(invoices.deletedAt),
        ));
      }
      const paidOk = !feesMustBeClear || statements.every((i) => i.status === "paid");
      const publishedCards = resultsVisible && paidOk && studentIds.length
        ? await db.select().from(reportCards).where(and(eq(reportCards.tenantId, tenant.id), inArray(reportCards.studentId, studentIds), eq(reportCards.published, true)))
        : [];
      const attendance = studentIds.length
        ? await db.select({
          studentId: attendanceRecords.studentId,
          status: attendanceRecords.status,
          date: attendanceSessions.date,
        })
          .from(attendanceRecords)
          .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
          .where(and(eq(attendanceRecords.tenantId, tenant.id), inArray(attendanceRecords.studentId, studentIds)))
          .orderBy(desc(attendanceSessions.date))
          .limit(30)
        : [];
      const receiptRows = studentIds.length
        ? await db.select({
          id: receipts.id,
          receiptNo: receipts.receiptNo,
          amount: receipts.amount,
          issuedAt: receipts.issuedAt,
          studentId: payments.studentId,
        })
          .from(receipts)
          .innerJoin(payments, eq(receipts.paymentId, payments.id))
          .where(and(
            eq(receipts.tenantId, tenant.id),
            inArray(payments.studentId, studentIds),
            isNull(payments.deletedAt),
          ))
          .orderBy(desc(receipts.issuedAt))
          .limit(20)
        : [];
      const msgs = await db.select().from(announcements).where(and(eq(announcements.tenantId, tenant.id), eq(announcements.published, true))).orderBy(desc(announcements.createdAt)).limit(10);
      res.json({ success: true, data: { children, statements, receipts: receiptRows, reportCards: publishedCards, attendance, announcements: msgs } });
    } else {
      const studentId = principal.account.studentId;
      const [student] = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.tenantId, tenant.id))).limit(1);
      if (!student) throw new NotFoundError("Student not found");
      const classAssignments = await db.select().from(assignments).where(eq(assignments.tenantId, tenant.id)).orderBy(desc(assignments.dueDate)).limit(20);
      let reportCard: unknown = null;
      if (resultsVisible) {
        const [rc] = await db.select().from(reportCards).where(and(eq(reportCards.studentId, student.id), eq(reportCards.published, true))).orderBy(desc(reportCards.createdAt)).limit(1);
        reportCard = rc ?? null;
      }
      const attendance = await db.select({
        status: attendanceRecords.status,
        date: attendanceSessions.date,
      })
        .from(attendanceRecords)
        .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
        .where(and(eq(attendanceRecords.tenantId, tenant.id), eq(attendanceRecords.studentId, student.id)))
        .orderBy(desc(attendanceSessions.date))
        .limit(30);
      res.json({ success: true, data: { student, assignments: classAssignments, reportCard, attendance } });
    }
  } catch (e) { next(e); }
});

router.get("/pdf/report-card/:id", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    const flags = await getTenantFeatureFlags(tenant.id);
    if (flags.results_visible === false) throw new ForbiddenError("Results are not available on the portal");

    const [rc] = await db.select().from(reportCards).where(and(
      eq(reportCards.id, req.params.id),
      eq(reportCards.tenantId, tenant.id),
      eq(reportCards.published, true),
    )).limit(1);
    if (!rc) throw new NotFoundError("Report card not found");

    await assertPortalCanAccessStudent(principal, tenant.id, rc.studentId);

    if (flags.fees_must_be_clear === true) {
      const studentInvoices = await db.select().from(invoices).where(and(
        eq(invoices.tenantId, tenant.id),
        eq(invoices.studentId, rc.studentId),
        isNull(invoices.deletedAt),
      ));
      if (studentInvoices.some((i) => i.status !== "paid")) {
        throw new ForbiddenError("Outstanding fees must be cleared before downloading results");
      }
    }

    const bytes = await generateReportCardPdf(tenant.id, rc.id);
    sendPdf(res, bytes, `report-card-${rc.id.slice(0, 8)}.pdf`);
  } catch (e) { next(e); }
});

router.get("/pdf/receipt/:id", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;

    const [rec] = await db.select().from(receipts).where(and(
      eq(receipts.id, req.params.id),
      eq(receipts.tenantId, tenant.id),
    )).limit(1);
    if (!rec) throw new NotFoundError("Receipt not found");

    const [payment] = await db.select().from(payments).where(and(
      eq(payments.id, rec.paymentId),
      eq(payments.tenantId, tenant.id),
      isNull(payments.deletedAt),
    )).limit(1);
    if (!payment?.studentId) throw new NotFoundError("Payment not found");

    await assertPortalCanAccessStudent(principal, tenant.id, payment.studentId);

    const bytes = await generateReceiptPdf(tenant.id, rec.id);
    sendPdf(res, bytes, `receipt-${rec.receiptNo ?? rec.id.slice(0, 8)}.pdf`);
  } catch (e) { next(e); }
});

export default router;
