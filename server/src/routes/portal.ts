import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  parentAccounts, studentAccounts, students, invoices, payments, receipts,
  reportCards, announcements, assignments, attendanceRecords, attendanceSessions,
  portalMessages, routeAssignments, transportRoutes, transportStops, tenantSettings,
  curriculumFrameworks, curriculumUnits, cbtPapers,
  vehicleGpsPings,
} from "../db/schema";
import { generateReportCardPdf, generateReceiptPdf, generateInvoicePdf } from "../services/pdf";
import { promoteScheduledAnnouncements } from "../services/announcements";
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
import { filterStudentsForPortal, getPortalAccessibleStudentIds } from "../services/portal-access";
import { getTenantFeatureFlags } from "../services/tenant-features";
import { isFeatureAllowedForTenant } from "../services/plan-features";
import { ForbiddenError, ConflictError, BadRequestError } from "../middleware/error";

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
      await promoteScheduledAnnouncements(tenant.id);
      const msgs = await db.select().from(announcements).where(and(eq(announcements.tenantId, tenant.id), eq(announcements.published, true))).orderBy(desc(announcements.createdAt)).limit(10);

      const transport = studentIds.length
        ? await db.select({
          studentId: routeAssignments.studentId,
          routeId: routeAssignments.routeId,
          routeName: transportRoutes.name,
          stopId: routeAssignments.stopId,
        })
          .from(routeAssignments)
          .innerJoin(transportRoutes, eq(transportRoutes.id, routeAssignments.routeId))
          .where(and(eq(routeAssignments.tenantId, tenant.id), inArray(routeAssignments.studentId, studentIds)))
        : [];

      const routeIds = [...new Set(transport.map((t) => t.routeId))];
      const stopsByRoute: Record<string, Array<{ name: string; orderNo: number }>> = {};
      for (const rid of routeIds) {
        const stops = await db.select({ name: transportStops.name, orderNo: transportStops.orderNo })
          .from(transportStops).where(and(eq(transportStops.routeId, rid), eq(transportStops.tenantId, tenant.id)))
          .orderBy(transportStops.orderNo);
        stopsByRoute[rid] = stops;
      }

      const paymentGateways = await isFeatureAllowedForTenant(tenant.id, "payment_gateways");
      const [settings] = await db.select({ currency: tenantSettings.currency }).from(tenantSettings)
        .where(eq(tenantSettings.tenantId, tenant.id)).limit(1);

      res.json({
        success: true,
        data: {
          children,
          statements,
          receipts: receiptRows,
          reportCards: publishedCards,
          attendance,
          announcements: msgs,
          transport: transport.map((t) => ({ ...t, stops: stopsByRoute[t.routeId] ?? [] })),
          paymentGatewaysEnabled: paymentGateways,
          currency: settings?.currency ?? "UGX",
        },
      });
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

router.post("/payments/initiate", requirePortalAuth,
  validate({
    body: z.object({
      invoiceId: z.string().uuid(),
      provider: z.enum(["flutterwave", "mtn_momo"]),
      payerPhone: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const principal = (req as any).portalPrincipal;
      const allowed = await isFeatureAllowedForTenant(tenant.id, "payment_gateways");
      if (!allowed) throw new ForbiddenError("Online payments are not enabled for this school");

      const [invoice] = await db.select().from(invoices).where(and(
        eq(invoices.id, req.body.invoiceId),
        eq(invoices.tenantId, tenant.id),
        isNull(invoices.deletedAt),
      )).limit(1);
      if (!invoice) throw new NotFoundError("Invoice not found");
      await assertPortalCanAccessStudent(principal, tenant.id, invoice.studentId);

      const balance = invoice.totalAmount - invoice.paidAmount;
      if (balance <= 0) throw new ConflictError("Invoice is already paid");

      const base = (process.env.CLIENT_ORIGIN || "").replace(/\/$/, "");
      const redirectUrl = `${base}/s/${tenant.slug}/portal/dashboard?paid=1`;
      const { initiateFlutterwavePayment, initiateMtnMomoCollection } = await import("../services/integration-runtime");

      const [parentRow] = principal.kind === "parent"
        ? await db.select({ email: parentAccounts.email }).from(parentAccounts).where(eq(parentAccounts.id, principal.account.id)).limit(1)
        : [null];

      const amountMajor = balance / 100;

      if (req.body.provider === "flutterwave") {
        const result = await initiateFlutterwavePayment({
          tenantId: tenant.id,
          invoiceId: invoice.id,
          amount: amountMajor,
          customerEmail: parentRow?.email ?? "parent@school.local",
          customerName: "Parent",
          redirectUrl,
        });
        if (!result.ok) return res.status(400).json({ success: false, message: result.message });
        return res.json({ success: true, data: result });
      }

      if (!req.body.payerPhone) throw new BadRequestError("payerPhone required for MTN MoMo");
      const result = await initiateMtnMomoCollection({
        tenantId: tenant.id,
        invoiceId: invoice.id,
        amount: amountMajor,
        payerPhone: req.body.payerPhone,
      });
      if (!result.ok) return res.status(400).json({ success: false, message: result.message });
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },
);

router.get("/pdf/invoice/:id", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    const [inv] = await db.select().from(invoices).where(and(
      eq(invoices.id, req.params.id),
      eq(invoices.tenantId, tenant.id),
      isNull(invoices.deletedAt),
    )).limit(1);
    if (!inv) throw new NotFoundError("Invoice not found");
    await assertPortalCanAccessStudent(principal, tenant.id, inv.studentId);
    const bytes = await generateInvoicePdf(tenant.id, inv.id);
    sendPdf(res, bytes, `invoice-${inv.invoiceNo}.pdf`);
  } catch (e) { next(e); }
});

router.get("/messages/:studentId", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    await assertPortalCanAccessStudent(principal, tenant.id, req.params.studentId);
    const rows = await db.select().from(portalMessages)
      .where(and(eq(portalMessages.tenantId, tenant.id), eq(portalMessages.studentId, req.params.studentId)))
      .orderBy(portalMessages.createdAt);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/messages", requirePortalAuth,
  validate({ body: z.object({ studentId: z.string().uuid(), body: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const principal = (req as any).portalPrincipal;
      if (principal.kind !== "parent") throw new ForbiddenError("Only parents can send messages");
      await assertPortalCanAccessStudent(principal, tenant.id, req.body.studentId);
      const [row] = await db.insert(portalMessages).values({
        tenantId: tenant.id,
        studentId: req.body.studentId,
        senderType: "parent",
        parentAccountId: principal.account.id,
        body: req.body.body,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

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

router.get("/curriculum", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [fw] = await db.select().from(curriculumFrameworks).where(and(eq(curriculumFrameworks.tenantId, tenant.id), eq(curriculumFrameworks.active, true))).limit(1);
    if (!fw) return res.json({ success: true, data: null });
    const units = await db.select({ id: curriculumUnits.id, title: curriculumUnits.title }).from(curriculumUnits).where(eq(curriculumUnits.frameworkId, fw.id)).limit(30);
    res.json({ success: true, data: { framework: fw, units } });
  } catch (e) { next(e); }
});

router.get("/transport-map", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    const studentId = req.query.studentId as string;
    if (studentId) await assertPortalCanAccessStudent(principal, tenant.id, studentId);
    const ids = await getPortalAccessibleStudentIds(principal);
    const targetId = studentId || ids[0];
    let routeId: string | undefined;
    if (targetId) {
      const [a] = await db.select().from(routeAssignments).where(and(eq(routeAssignments.tenantId, tenant.id), eq(routeAssignments.studentId, targetId))).limit(1);
      routeId = a?.routeId;
    }
    const stops = routeId
      ? await db.select().from(transportStops).where(and(eq(transportStops.tenantId, tenant.id), eq(transportStops.routeId, routeId)))
      : [];
    const [route] = routeId ? await db.select().from(transportRoutes).where(eq(transportRoutes.id, routeId)).limit(1) : [];
    const pings = await db.select().from(vehicleGpsPings).where(eq(vehicleGpsPings.tenantId, tenant.id)).orderBy(desc(vehicleGpsPings.recordedAt)).limit(5);
    res.json({ success: true, data: { route: route ?? null, stops, vehicleLocation: pings[0] ?? null } });
  } catch (e) { next(e); }
});

router.get("/cbt/available", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    const studentId = req.query.studentId as string;
    if (studentId) await assertPortalCanAccessStudent(principal, tenant.id, studentId);
    const ids = await getPortalAccessibleStudentIds(principal);
    const targetId = studentId || ids[0];
    if (!targetId) return res.json({ success: true, data: [] });
    const papers = await db.select().from(cbtPapers).where(and(eq(cbtPapers.tenantId, tenant.id), eq(cbtPapers.published, true)));
    res.json({ success: true, data: papers, studentId: targetId });
  } catch (e) { next(e); }
});

export default router;
