import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  parentAccounts, studentAccounts, students, invoices, payments, receipts,
  reportCards, announcements, assignments, attendanceRecords, attendanceSessions,
  portalMessages, routeAssignments, transportRoutes, transportStops, tenantSettings,
  curriculumFrameworks, curriculumUnits, cbtPapers, timetablePeriods, studentMaterials, onlineClassLinks,
  onlineClassAttendance, assignmentSubmissions, studentClassHistory, schoolEvents,
  vehicleGpsPings, studentLeaveRequests, gatePasses, disciplineIncidents, disciplineActions,
  classes, streams, sickbayVisits,
} from "../db/schema";
import { adminAssistantReply, studyRecommendations } from "../services/ai-admin";
import { generateReportCardPdf, generateReceiptPdf, generateInvoicePdf } from "../services/pdf";
import { promoteScheduledAnnouncements } from "../services/announcements";
import { assertPortalCanAccessStudent } from "../services/portal-access";
import { eq, and, desc, inArray, isNull } from "drizzle-orm";
import {
  requirePortalAuth,
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

router.post("/logout", requirePortalAuth, async (req, res) => {
  const token = req.cookies?.portal_session_token;
  if (token) await deletePortalSession(token);
  res.clearCookie("portal_session_token");
  res.json({ success: true });
});

router.get("/me", requirePortalAuth, async (req, res, next) => {
  try {
    const principal = (req as any).portalPrincipal;
    const prefs = principal.kind === "parent"
      ? ((principal.account.preferencesJson ?? {}) as { theme?: "light" | "dark" })
      : ((principal.account.preferencesJson ?? {}) as { theme?: "light" | "dark" });
    res.json({
      success: true,
      account: {
        id: principal.account.id,
        email: principal.account.email,
        type: principal.kind,
        preferences: { theme: prefs.theme === "light" ? "light" : "dark" },
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
      const [settings] = await db.select({
        currency: tenantSettings.currency,
        paymentProvidersJson: tenantSettings.paymentProvidersJson,
      }).from(tenantSettings)
        .where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      const { normalizePaymentProviders, isPaypalReady, isPesapalReady } = await import("../lib/payment-providers");
      const payCfg = normalizePaymentProviders(settings?.paymentProvidersJson as Record<string, unknown>);

      const { buildParentPortalExtras } = await import("../services/portal-parent-data");
      const parentExtras = await buildParentPortalExtras(tenant.id, studentIds, principal);

      const attendance = studentIds.flatMap((sid) =>
        (parentExtras.classAttendanceByStudent[sid] ?? []).map((r) => ({
          studentId: sid,
          id: r.id,
          status: r.status,
          date: r.date,
          className: r.className,
          streamName: r.streamName,
          note: r.note,
          inCurrentTerm: r.inCurrentTerm,
        })),
      );

      const leaves = studentIds.length
        ? await db.select().from(studentLeaveRequests)
          .where(and(eq(studentLeaveRequests.tenantId, tenant.id), inArray(studentLeaveRequests.studentId, studentIds)))
          .orderBy(desc(studentLeaveRequests.createdAt))
          .limit(30)
        : [];

      const gatePassRows = studentIds.length
        ? await db.select({
          id: gatePasses.id,
          studentId: gatePasses.studentId,
          passNumber: gatePasses.passNumber,
          visitorName: gatePasses.visitorName,
          relationToStudent: gatePasses.relationToStudent,
          passDate: gatePasses.passDate,
          inTime: gatePasses.inTime,
          outTime: gatePasses.outTime,
          status: gatePasses.status,
          purpose: gatePasses.purpose,
        })
          .from(gatePasses)
          .where(and(eq(gatePasses.tenantId, tenant.id), inArray(gatePasses.studentId, studentIds)))
          .orderBy(desc(gatePasses.passDate))
          .limit(25)
        : [];

      const disciplineRows = studentIds.length
        ? await db.select({
          id: disciplineIncidents.id,
          studentId: disciplineIncidents.studentId,
          incidentDate: disciplineIncidents.incidentDate,
          category: disciplineIncidents.category,
          description: disciplineIncidents.description,
          severity: disciplineIncidents.severity,
        })
          .from(disciplineIncidents)
          .where(and(eq(disciplineIncidents.tenantId, tenant.id), inArray(disciplineIncidents.studentId, studentIds)))
          .orderBy(desc(disciplineIncidents.incidentDate))
          .limit(25)
        : [];

      const incidentIds = disciplineRows.map((d) => d.id);
      const actionRows = incidentIds.length
        ? await db.select({
          incidentId: disciplineActions.incidentId,
          action: disciplineActions.action,
          actionDate: disciplineActions.actionDate,
          notes: disciplineActions.notes,
        })
          .from(disciplineActions)
          .where(and(eq(disciplineActions.tenantId, tenant.id), inArray(disciplineActions.incidentId, incidentIds)))
        : [];

      const sickbayRows = studentIds.length
        ? await db.select({
          id: sickbayVisits.id,
          studentId: sickbayVisits.studentId,
          visitDate: sickbayVisits.visitDate,
          complaint: sickbayVisits.complaint,
          treatment: sickbayVisits.treatment,
          dischargedAt: sickbayVisits.dischargedAt,
        })
          .from(sickbayVisits)
          .where(and(eq(sickbayVisits.tenantId, tenant.id), inArray(sickbayVisits.studentId, studentIds)))
          .orderBy(desc(sickbayVisits.visitDate))
          .limit(15)
        : [];

      const actionsByIncident: Record<string, typeof actionRows> = {};
      for (const a of actionRows) {
        if (!actionsByIncident[a.incidentId]) actionsByIncident[a.incidentId] = [];
        actionsByIncident[a.incidentId].push(a);
      }

      res.json({
        success: true,
        data: {
          children,
          enrollments: parentExtras.enrollmentsEnhanced,
          ...parentExtras,
          statements,
          receipts: receiptRows,
          reportCards: publishedCards,
          attendance,
          announcements: msgs,
          transport: transport.map((t) => ({ ...t, stops: stopsByRoute[t.routeId] ?? [] })),
          leaves,
          gatePasses: gatePassRows,
          discipline: disciplineRows.map((d) => ({ ...d, actions: actionsByIncident[d.id] ?? [] })),
          sickbay: sickbayRows,
          paymentGatewaysEnabled: paymentGateways,
          paymentProviders: {
            paypal: isPaypalReady(payCfg),
            pesapal: isPesapalReady(payCfg),
          },
          currency: settings?.currency ?? "UGX",
          resultsVisible,
          feesMustBeClear,
        },
      });
    } else {
      const studentId = principal.account.studentId;
      const [student] = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.tenantId, tenant.id))).limit(1);
      if (!student) throw new NotFoundError("Student not found");
      const [enrollment] = await db.select().from(studentClassHistory).where(and(
        eq(studentClassHistory.studentId, student.id),
        eq(studentClassHistory.tenantId, tenant.id),
        isNull(studentClassHistory.toDate),
      )).orderBy(desc(studentClassHistory.fromDate)).limit(1);
      const classAssignments = enrollment
        ? await db.select().from(assignments).where(and(
            eq(assignments.tenantId, tenant.id),
            eq(assignments.classId, enrollment.classId),
          )).orderBy(desc(assignments.dueDate)).limit(20)
        : [];
      const mySubmissions = await db.select().from(assignmentSubmissions).where(and(
        eq(assignmentSubmissions.tenantId, tenant.id),
        eq(assignmentSubmissions.studentId, student.id),
      ));
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
      await promoteScheduledAnnouncements(tenant.id);
      const noticeboard = await db.select().from(announcements).where(and(
        eq(announcements.tenantId, tenant.id),
        eq(announcements.published, true),
        inArray(announcements.audience, ["all", "students"]),
      )).orderBy(desc(announcements.createdAt)).limit(15);
      const myLeaves = await db.select().from(studentLeaveRequests).where(and(
        eq(studentLeaveRequests.tenantId, tenant.id),
        eq(studentLeaveRequests.studentId, student.id),
      )).orderBy(desc(studentLeaveRequests.createdAt)).limit(10);

      const { buildStudentPortalExtras } = await import("../services/portal-student-data");
      const extras = await buildStudentPortalExtras(tenant.id, student.id);
      const [settings] = await db.select({
        currency: tenantSettings.currency,
      }).from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);

      res.json({
        success: true,
        data: {
          student,
          assignments: classAssignments,
          submissions: mySubmissions,
          reportCard,
          attendance,
          noticeboard,
          leaves: myLeaves,
          currency: settings?.currency ?? "UGX",
          resultsVisible,
          feesMustBeClear,
          ...extras,
        },
      });
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
      provider: z.enum(["flutterwave", "mtn_momo", "paypal", "pesapal", "airtel_money"]),
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

      const { resolveClientOrigin } = await import("../lib/app-origin");
      const base = await resolveClientOrigin();
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

      if (req.body.provider === "mtn_momo" || req.body.provider === "airtel_money") {
        if (!req.body.payerPhone) throw new BadRequestError("payerPhone required for mobile money");
        const result = await initiateMtnMomoCollection({
          tenantId: tenant.id,
          invoiceId: invoice.id,
          amount: amountMajor,
          payerPhone: req.body.payerPhone,
        });
        if (!result.ok) return res.status(400).json({ success: false, message: result.message });
        return res.json({ success: true, data: result });
      }

      if (req.body.provider === "paypal" || req.body.provider === "pesapal") {
        const { initiateTenantGatewayPayment } = await import("../services/integration-runtime");
        const [settings] = await db.select({ currency: tenantSettings.currency }).from(tenantSettings)
          .where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
        const result = await initiateTenantGatewayPayment({
          tenantId: tenant.id,
          provider: req.body.provider,
          invoiceId: invoice.id,
          amount: amountMajor,
          currency: settings?.currency ?? "UGX",
          customerEmail: parentRow?.email ?? "parent@school.local",
          redirectUrl,
        });
        if (!result.ok) return res.status(400).json({ success: false, message: result.message });
        return res.json({ success: true, data: result });
      }

      return res.status(400).json({ success: false, message: "Unknown payment provider" });
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
  validate({ body: z.object({
    studentId: z.string().uuid().optional(),
    recipientUserId: z.string().uuid().optional(),
    body: z.string().min(1),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const principal = (req as any).portalPrincipal;
      const recipientUserId = req.body.recipientUserId as string | undefined;

      if (principal.kind === "parent") {
        if (!req.body.studentId) throw new BadRequestError("studentId is required");
        await assertPortalCanAccessStudent(principal, tenant.id, req.body.studentId);
        const { assertParentCanMessageRecipient } = await import("../services/portal-messaging");
        await assertParentCanMessageRecipient(tenant.id, principal.account.guardianId, req.body.studentId, recipientUserId);
        const [row] = await db.insert(portalMessages).values({
          tenantId: tenant.id,
          studentId: req.body.studentId,
          senderType: "parent",
          parentAccountId: principal.account.id,
          recipientUserId: recipientUserId ?? null,
          body: req.body.body,
        }).returning();
        return res.status(201).json({ success: true, data: row });
      }

      if (principal.kind === "student") {
        const studentId = principal.account.studentId;
        if (!recipientUserId) throw new BadRequestError("Choose who to send this message to");
        const { assertStudentCanMessageRecipient } = await import("../services/portal-messaging");
        await assertStudentCanMessageRecipient(tenant.id, studentId, recipientUserId);
        const [row] = await db.insert(portalMessages).values({
          tenantId: tenant.id,
          studentId,
          senderType: "student",
          recipientUserId,
          body: req.body.body,
        }).returning();
        return res.status(201).json({ success: true, data: row });
      }

      throw new ForbiddenError("Invalid portal account");
    } catch (e) { next(e); }
  },
);

router.get("/messages/recipients", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    const { getStudentMessageRecipients } = await import("../services/portal-messaging");

    if (principal.kind === "student") {
      const data = await getStudentMessageRecipients(tenant.id, principal.account.studentId);
      return res.json({ success: true, data: [...data.teachers, ...data.admins] });
    }

    if (principal.kind === "parent") {
      const studentId = String(req.query.studentId ?? "");
      if (!studentId) throw new BadRequestError("studentId is required");
      await assertPortalCanAccessStudent(principal, tenant.id, studentId);
      const data = await getStudentMessageRecipients(tenant.id, studentId);
      return res.json({ success: true, data: [...data.teachers, ...data.admins] });
    }

    throw new ForbiddenError("Students and parents only");
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

router.get("/student/results", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    if (principal.kind !== "student") throw new ForbiddenError("Students only");
    const { listStudentPublishedResults } = await import("../services/portal-student-data");
    const rows = await listStudentPublishedResults(tenant.id, principal.account.studentId);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.get("/student/timetable", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    if (principal.kind !== "student") throw new ForbiddenError("Students only");
    const [acc] = await db.select().from(studentAccounts).where(eq(studentAccounts.id, principal.account.id)).limit(1);
    if (!acc) throw new NotFoundError("Account not found");
    const studentId = principal.account.studentId;
    const [enrollment] = await db.select({ classId: studentClassHistory.classId })
      .from(studentClassHistory)
      .where(and(
        eq(studentClassHistory.studentId, studentId),
        eq(studentClassHistory.tenantId, tenant.id),
        isNull(studentClassHistory.toDate),
      ))
      .orderBy(desc(studentClassHistory.fromDate))
      .limit(1);
    const { listStudentFullTimetable } = await import("../services/portal-student-data");
    const periods = await listStudentFullTimetable(tenant.id, enrollment?.classId ?? null);
    res.json({ success: true, data: periods });
  } catch (e) { next(e); }
});

router.get("/student/materials", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    if (principal.kind !== "student") throw new ForbiddenError("Students only");
    const { listStudentMaterials } = await import("../services/portal-student-academics");
    const data = await listStudentMaterials(tenant.id, principal.account.studentId, {
      folder: typeof req.query.folder === "string" ? req.query.folder : undefined,
      subjectId: typeof req.query.subjectId === "string" ? req.query.subjectId : undefined,
    });
    res.json({ success: true, data: data.materials, folders: data.folders });
  } catch (e) { next(e); }
});

router.get("/student/online-classes", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { listOnlineClassesForTenant } = await import("../lib/academics-query");
    const rows = await listOnlineClassesForTenant(tenant.id);
    res.json({ success: true, data: rows.slice(0, 30) });
  } catch (e) { next(e); }
});

router.post("/student/online-classes/:id/join", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    if (principal.kind !== "student") throw new ForbiddenError("Students only");
    const studentId = principal.account.studentId;
    const { getOnlineClassById } = await import("../lib/academics-query");
    const link = await getOnlineClassById(tenant.id, req.params.id);
    if (!link) throw new NotFoundError("Class not found");
    const [ex] = await db.select().from(onlineClassAttendance).where(and(
      eq(onlineClassAttendance.onlineClassId, link.id),
      eq(onlineClassAttendance.studentId, studentId),
    )).limit(1);
    if (ex) {
      const [row] = await db.update(onlineClassAttendance).set({
        status: "present",
        joinedAt: new Date(),
      }).where(eq(onlineClassAttendance.id, ex.id)).returning();
      return res.json({ success: true, data: row });
    }
    const [row] = await db.insert(onlineClassAttendance).values({
      tenantId: tenant.id,
      onlineClassId: link.id,
      studentId,
      status: "present",
      joinedAt: new Date(),
    }).returning();
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

function portalStudentId(req: any): string {
  const principal = req.portalPrincipal;
  if (principal?.kind !== "student") throw new ForbiddenError("Students only");
  return principal.account.studentId;
}

router.get("/student/assignments", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { listStudentAssignmentsEnriched } = await import("../services/portal-student-academics");
    res.json({ success: true, data: await listStudentAssignmentsEnriched(tenant.id, portalStudentId(req)) });
  } catch (e) { next(e); }
});

router.get("/student/assignments/:id", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { getStudentAssignmentDetail } = await import("../services/portal-student-academics");
    res.json({ success: true, data: await getStudentAssignmentDetail(tenant.id, portalStudentId(req), req.params.id) });
  } catch (e) { next(e); }
});

router.post("/student/assignments/:id/submit", requirePortalAuth,
  validate({ body: z.object({ content: z.string().min(1), draft: z.boolean().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const { upsertAssignmentSubmission } = await import("../services/portal-student-academics");
      const row = await upsertAssignmentSubmission(
        tenant.id,
        portalStudentId(req),
        req.params.id,
        req.body.content,
        req.body.draft === true,
      );
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.patch("/student/assignments/:id/submission", requirePortalAuth,
  validate({ body: z.object({ content: z.string().min(1), draft: z.boolean().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const { upsertAssignmentSubmission } = await import("../services/portal-student-academics");
      const row = await upsertAssignmentSubmission(
        tenant.id,
        portalStudentId(req),
        req.params.id,
        req.body.content,
        req.body.draft === true,
      );
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/student/assignments/:id/submission", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { deleteAssignmentSubmission } = await import("../services/portal-student-academics");
    await deleteAssignmentSubmission(tenant.id, portalStudentId(req), req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get("/student/cbt/papers", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { listStudentCbtPapers } = await import("../services/portal-student-academics");
    res.json({ success: true, data: await listStudentCbtPapers(tenant.id, portalStudentId(req)) });
  } catch (e) { next(e); }
});

router.get("/student/cbt/sessions", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { listStudentCbtSessions } = await import("../services/portal-student-academics");
    res.json({ success: true, data: await listStudentCbtSessions(tenant.id, portalStudentId(req)) });
  } catch (e) { next(e); }
});

router.get("/student/cbt/sessions/:id", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { getStudentCbtSessionDetail } = await import("../services/portal-student-academics");
    res.json({ success: true, data: await getStudentCbtSessionDetail(tenant.id, portalStudentId(req), req.params.id) });
  } catch (e) { next(e); }
});

router.post("/student/cbt/sessions/start", requirePortalAuth,
  validate({ body: z.object({ paperId: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const { startStudentCbtSession } = await import("../services/portal-student-academics");
      const data = await startStudentCbtSession(tenant.id, portalStudentId(req), req.body.paperId, {
        ipAddress: req.ip,
        deviceFingerprint: req.headers["x-device-fingerprint"] as string | undefined,
      });
      res.status(201).json({ success: true, data });
    } catch (e) { next(e); }
  },
);

router.post("/student/cbt/sessions/:id/answer", requirePortalAuth,
  validate({ body: z.object({ questionId: z.string().uuid(), answer: z.union([z.number(), z.string(), z.record(z.unknown())]) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const { saveStudentCbtAnswer } = await import("../services/portal-student-academics");
      const result = await saveStudentCbtAnswer(
        tenant.id,
        portalStudentId(req),
        req.params.id,
        req.body.questionId,
        req.body.answer,
      );
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },
);

router.post("/student/cbt/sessions/:id/submit", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { submitStudentCbtSession } = await import("../services/portal-student-academics");
    const row = await submitStudentCbtSession(tenant.id, portalStudentId(req), req.params.id);
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
});

router.get("/student/library", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { getStudentLibraryOverview } = await import("../services/portal-student-academics");
    res.json({ success: true, data: await getStudentLibraryOverview(tenant.id, portalStudentId(req)) });
  } catch (e) { next(e); }
});

router.get("/student/library/catalog", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ success: true, data: { books: [], ebooks: [] } });
    const { searchLibraryCatalog } = await import("../services/portal-student-academics");
    res.json({ success: true, data: await searchLibraryCatalog(tenant.id, q) });
  } catch (e) { next(e); }
});

router.get("/student/library/reservations", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { getStudentLibraryOverview } = await import("../services/portal-student-academics");
    const overview = await getStudentLibraryOverview(tenant.id, portalStudentId(req));
    res.json({ success: true, data: overview.reservations });
  } catch (e) { next(e); }
});

router.post("/student/library/reservations", requirePortalAuth,
  validate({ body: z.object({ bookId: z.string().uuid().optional(), ebookId: z.string().uuid().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const { createLibraryReservation } = await import("../services/portal-student-academics");
      const row = await createLibraryReservation(tenant.id, portalStudentId(req), req.body.bookId, req.body.ebookId);
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.delete("/student/library/reservations/:id", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { cancelLibraryReservation } = await import("../services/portal-student-academics");
    await cancelLibraryReservation(tenant.id, portalStudentId(req), req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get("/student/events", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { listStudentSchoolEvents } = await import("../services/portal-student-calendar");
    res.json({ success: true, data: await listStudentSchoolEvents(tenant.id, { filter: "upcoming", limit: 30 }) });
  } catch (e) { next(e); }
});

router.get("/student/calendar", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { getStudentCalendarOverview } = await import("../services/portal-student-calendar");
    res.json({ success: true, data: await getStudentCalendarOverview(tenant.id) });
  } catch (e) { next(e); }
});

router.get("/student/calendar/events", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const filter = (req.query.filter as "upcoming" | "past" | "all") || "upcoming";
    const eventType = typeof req.query.eventType === "string" ? req.query.eventType : undefined;
    const { listStudentSchoolEvents } = await import("../services/portal-student-calendar");
    res.json({
      success: true,
      data: await listStudentSchoolEvents(tenant.id, {
        filter: ["upcoming", "past", "all"].includes(filter) ? filter : "upcoming",
        eventType,
        limit: 80,
      }),
    });
  } catch (e) { next(e); }
});

router.get("/student/calendar/events/:id", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { getStudentSchoolEvent } = await import("../services/portal-student-calendar");
    res.json({ success: true, data: await getStudentSchoolEvent(tenant.id, req.params.id) });
  } catch (e) { next(e); }
});

router.get("/student/noticeboard", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const { listStudentAnnouncements } = await import("../services/portal-student-calendar");
    res.json({ success: true, data: await listStudentAnnouncements(tenant.id, { q, limit: 50 }) });
  } catch (e) { next(e); }
});

router.get("/student/noticeboard/:id", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const { getStudentAnnouncement } = await import("../services/portal-student-calendar");
    res.json({ success: true, data: await getStudentAnnouncement(tenant.id, req.params.id) });
  } catch (e) { next(e); }
});

router.get("/student/materials/:id/file", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    const [mat] = await db.select().from(studentMaterials).where(and(
      eq(studentMaterials.id, req.params.id),
      eq(studentMaterials.tenantId, tenant.id),
    )).limit(1);
    if (!mat?.filePath) throw new NotFoundError("File not found");
    if (principal.kind === "student" && mat.classId) {
      const { getStudentEnrollmentClassId } = await import("../services/portal-student-academics");
      const classId = await getStudentEnrollmentClassId(tenant.id, principal.account.studentId);
      if (classId && mat.classId !== classId) throw new ForbiddenError("Material not available for your class");
    }
    const { resolveTenantFile } = await import("../lib/uploads");
    res.sendFile(resolveTenantFile(tenant.id, mat.filePath));
  } catch (e) { next(e); }
});

router.post("/student/tutor", requirePortalAuth,
  validate({ body: z.object({ message: z.string().min(1), subject: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const reply = await adminAssistantReply(tenant.id, req.body.message);
      const plan = req.body.subject ? await studyRecommendations(tenant.id, req.body.subject) : [];
      res.json({ success: true, data: { reply, studyPlan: plan } });
    } catch (e) { next(e); }
  },
);

router.get("/noticeboard", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    await promoteScheduledAnnouncements(tenant.id);
    const audienceFilter = principal.kind === "student"
      ? ["all", "students"]
      : ["all", "parents", "students"];
    const rows = await db.select().from(announcements).where(and(
      eq(announcements.tenantId, tenant.id),
      eq(announcements.published, true),
      inArray(announcements.audience, audienceFilter as string[]),
    )).orderBy(desc(announcements.createdAt)).limit(30);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.get("/leaves", requirePortalAuth, async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const principal = (req as any).portalPrincipal;
    const studentIds = await getPortalAccessibleStudentIds(principal);
    if (!studentIds.length) return res.json({ success: true, data: [] });
    const rows = await db.select().from(studentLeaveRequests).where(and(
      eq(studentLeaveRequests.tenantId, tenant.id),
      inArray(studentLeaveRequests.studentId, studentIds),
    )).orderBy(desc(studentLeaveRequests.createdAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/leaves", requirePortalAuth,
  validate({ body: z.object({
    studentId: z.string().uuid().optional(),
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string().min(1),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const principal = (req as any).portalPrincipal;
      let studentId = req.body.studentId;
      if (principal.kind === "student") {
        studentId = principal.account.studentId;
      } else if (!studentId) {
        throw new BadRequestError("studentId is required for parent leave requests");
      }
      await assertPortalCanAccessStudent(principal, tenant.id, studentId!);
      const [row] = await db.insert(studentLeaveRequests).values({
        tenantId: tenant.id,
        studentId: studentId!,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        reason: req.body.reason,
        status: "pending",
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

export default router;
