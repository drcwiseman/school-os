import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  feeHeads, feeConcessionPolicies, studentFeeConcessions, donations, recurringFeeSchedules,
  budgets, expenses, payments, receipts, invoices, students, tenantSettings, invoiceItems,
} from "../db/schema";
import { eq, and, desc, isNull, sql, gte } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError } from "../middleware/error";
import { generateInvoicesFromStructure, runDueRecurringSchedules } from "../services/invoice-generation";
import { isIntegrationEnabled } from "../services/integration-runtime";
import { isFeatureAllowedForTenant } from "../services/plan-features";
import { enqueueJob } from "../services/queue";

export const financeEnhancementsRouter = Router();
financeEnhancementsRouter.use(requireAuth, requireTenantMatch);

financeEnhancementsRouter.get("/accounts-dashboard", requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [inv] = await db.select({
      totalInvoiced: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
      totalPaid: sql<number>`coalesce(sum(${invoices.paidAmount}), 0)`,
      unpaidCount: sql<number>`count(*) filter (where ${invoices.status} = 'unpaid')`,
      overdueCount: sql<number>`count(*) filter (where ${invoices.dueDate} < now() and ${invoices.paidAmount} < ${invoices.totalAmount})`,
    }).from(invoices).where(and(eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt)));

    const [exp] = await db.select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(eq(expenses.tenantId, tenant.id));
    const [don] = await db.select({ total: sql<number>`coalesce(sum(${donations.amountMinor}), 0)` }).from(donations).where(eq(donations.tenantId, tenant.id));
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const collectedByMonth = await db.select({
      month: sql<string>`to_char(${payments.paidAt}, 'YYYY-MM')`,
      amount: sql<number>`coalesce(sum(${payments.amount}), 0)`,
    }).from(payments).where(and(eq(payments.tenantId, tenant.id), isNull(payments.deletedAt), gte(payments.paidAt, monthStart)))
      .groupBy(sql`to_char(${payments.paidAt}, 'YYYY-MM')`);

    const feeByType = await db.select({
      feeType: feeHeads.feeType,
      amount: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
    }).from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .innerJoin(feeHeads, eq(invoiceItems.feeHeadId, feeHeads.id))
      .where(and(eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt)))
      .groupBy(feeHeads.feeType);

    res.json({
      success: true,
      data: {
        ...inv,
        expensesMinor: Number(exp?.total ?? 0),
        donationsMinor: Number(don?.total ?? 0),
        netMinor: Number(inv?.totalPaid ?? 0) - Number(exp?.total ?? 0) + Number(don?.total ?? 0),
        collectedByMonth,
        feeByType,
      },
    });
  } catch (e) { next(e); }
});

financeEnhancementsRouter.get("/payments/history", requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      payment: payments,
      receipt: receipts,
      student: { firstName: students.firstName, lastName: students.lastName, admissionNumber: students.admissionNumber },
      invoiceNo: invoices.invoiceNo,
    }).from(payments)
      .innerJoin(students, eq(payments.studentId, students.id))
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .leftJoin(receipts, eq(receipts.paymentId, payments.id))
      .where(and(eq(payments.tenantId, tenant.id), isNull(payments.deletedAt)))
      .orderBy(desc(payments.paidAt))
      .limit(200);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

financeEnhancementsRouter.get("/payment-gateways", requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const gatewaysEnabled = await isFeatureAllowedForTenant(tenant.id, "payment_gateways");
    const flutterwave = await isIntegrationEnabled("flutterwave");
    const mtn = await isIntegrationEnabled("mtn_momo");
    const [settings] = await db.select({ providers: tenantSettings.paymentProvidersJson }).from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
    res.json({
      success: true,
      data: {
        featureEnabled: gatewaysEnabled,
        providers: [
          { id: "flutterwave", name: "Flutterwave", enabled: flutterwave, methods: ["card", "mobile"] },
          { id: "mtn_momo", name: "MTN MoMo", enabled: mtn, methods: ["mobile"] },
          { id: "cash", name: "Cash / offline", enabled: true, methods: ["cash", "bank"] },
        ],
        tenantConfig: settings?.providers ?? {},
      },
    });
  } catch (e) { next(e); }
});

// ─── Auto invoice schedules ───
financeEnhancementsRouter.get("/recurring-schedules", requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(recurringFeeSchedules).where(eq(recurringFeeSchedules.tenantId, tenant.id)).orderBy(desc(recurringFeeSchedules.createdAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

financeEnhancementsRouter.post("/recurring-schedules", requirePermission("finance.invoice.create"),
  validate({ body: z.object({
    name: z.string(),
    feeStructureId: z.string().uuid(),
    termId: z.string().uuid(),
    classId: z.string().uuid(),
    frequency: z.enum(["term", "monthly", "annual"]).optional(),
    dueDaysAfter: z.number().int().optional(),
    runAt: z.string().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const nextRun = req.body.runAt ? new Date(req.body.runAt) : new Date();
      const [row] = await db.insert(recurringFeeSchedules).values({
        tenantId: tenant.id,
        name: req.body.name,
        feeStructureId: req.body.feeStructureId,
        termId: req.body.termId,
        classId: req.body.classId,
        frequency: req.body.frequency ?? "term",
        dueDaysAfter: req.body.dueDaysAfter ?? 14,
        nextRunAt: nextRun,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

financeEnhancementsRouter.post("/invoices/auto-generate", requirePermission("finance.invoice.create"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const body = await z.object({
      scheduleId: z.string().uuid().optional(),
      feeStructureId: z.string().uuid().optional(),
      termId: z.string().uuid().optional(),
      classId: z.string().uuid().optional(),
      runAllDue: z.boolean().optional(),
    }).parseAsync(req.body);

    if (body.runAllDue) {
      const result = await runDueRecurringSchedules(tenant.id);
      return res.json({ success: true, data: result });
    }

    if (body.scheduleId) {
      const [sched] = await db.select().from(recurringFeeSchedules).where(and(
        eq(recurringFeeSchedules.id, body.scheduleId), eq(recurringFeeSchedules.tenantId, tenant.id),
      )).limit(1);
      if (!sched?.classId || !sched.termId) throw new NotFoundError("Schedule missing class or term");
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + sched.dueDaysAfter);
      const result = await generateInvoicesFromStructure({
        tenantId: tenant.id,
        feeStructureId: sched.feeStructureId,
        termId: sched.termId,
        classId: sched.classId,
        dueDate,
        skipExistingForTerm: true,
      });
      await db.update(recurringFeeSchedules).set({ lastRunAt: new Date() }).where(eq(recurringFeeSchedules.id, sched.id));
      return res.json({ success: true, data: result });
    }

    if (body.feeStructureId && body.termId && body.classId) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const result = await generateInvoicesFromStructure({
        tenantId: tenant.id,
        feeStructureId: body.feeStructureId,
        termId: body.termId,
        classId: body.classId,
        dueDate,
        skipExistingForTerm: Boolean(req.query.skipExisting),
      });
      return res.json({ success: true, data: result });
    }

    res.status(400).json({ success: false, message: "Provide scheduleId, runAllDue, or feeStructureId+termId+classId" });
  } catch (e) { next(e); }
});

financeEnhancementsRouter.post("/invoices/auto-generate/queue", requirePermission("finance.invoice.create"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const job = await enqueueJob(tenant.id, "finance.auto_invoices", { tenantId: tenant.id });
    res.json({ success: true, data: { jobId: job.id } });
  } catch (e) { next(e); }
});

// ─── Concession policies ───
financeEnhancementsRouter.get("/concession-policies", requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(feeConcessionPolicies).where(eq(feeConcessionPolicies.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

financeEnhancementsRouter.post("/concession-policies", requirePermission("finance.invoice.create"),
  validate({ body: z.object({ name: z.string(), category: z.string(), percent: z.number().optional(), amountMinor: z.number().optional(), description: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(feeConcessionPolicies).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

financeEnhancementsRouter.get("/student-concessions", requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select({
      concession: studentFeeConcessions,
      student: { firstName: students.firstName, lastName: students.lastName, admissionNumber: students.admissionNumber },
      policyName: feeConcessionPolicies.name,
    }).from(studentFeeConcessions)
      .innerJoin(students, eq(studentFeeConcessions.studentId, students.id))
      .leftJoin(feeConcessionPolicies, eq(studentFeeConcessions.policyId, feeConcessionPolicies.id))
      .where(eq(studentFeeConcessions.tenantId, tenant.id))
      .orderBy(desc(studentFeeConcessions.createdAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

financeEnhancementsRouter.post("/student-concessions", requirePermission("finance.invoice.create"),
  validate({ body: z.object({
    studentId: z.string().uuid(),
    policyId: z.string().uuid().optional(),
    termId: z.string().uuid().optional(),
    percent: z.number().optional(),
    amountMinor: z.number().optional(),
    reason: z.string().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      let percent = req.body.percent;
      let amountMinor = req.body.amountMinor;
      if (req.body.policyId) {
        const [p] = await db.select().from(feeConcessionPolicies).where(eq(feeConcessionPolicies.id, req.body.policyId)).limit(1);
        if (p) {
          percent = percent ?? p.percent ?? undefined;
          amountMinor = amountMinor ?? p.amountMinor ?? undefined;
        }
      }
      const [row] = await db.insert(studentFeeConcessions).values({
        tenantId: tenant.id,
        studentId: req.body.studentId,
        policyId: req.body.policyId,
        termId: req.body.termId,
        percent,
        amountMinor,
        reason: req.body.reason,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

// ─── Donations ───
financeEnhancementsRouter.get("/donations", requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(donations).where(eq(donations.tenantId, tenant.id)).orderBy(desc(donations.receivedAt)) });
  } catch (e) { next(e); }
});

financeEnhancementsRouter.post("/donations", requirePermission("finance.payment.create"),
  validate({ body: z.object({
    donorName: z.string(),
    amountMinor: z.number().int().positive(),
    purpose: z.string().optional(),
    paymentMethod: z.string().optional(),
    reference: z.string().optional(),
    receivedAt: z.string().optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(donations).values({
        tenantId: tenant.id,
        donorName: req.body.donorName,
        amountMinor: req.body.amountMinor,
        purpose: req.body.purpose,
        paymentMethod: req.body.paymentMethod ?? "cash",
        reference: req.body.reference,
        receivedAt: req.body.receivedAt ? new Date(req.body.receivedAt) : undefined,
        createdBy: user.id,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

// ─── Budgets enhanced ───
financeEnhancementsRouter.get("/budgets/overview", requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const budgetRows = await db.select().from(budgets).where(eq(budgets.tenantId, tenant.id));
    const expenseByCat = await db.select({
      category: expenses.category,
      spent: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
    }).from(expenses).where(eq(expenses.tenantId, tenant.id)).groupBy(expenses.category);

    const catMap = Object.fromEntries(expenseByCat.map((e) => [e.category ?? "general", Number(e.spent)]));
    const overview = budgetRows.map((b) => ({
      ...b,
      actualSpentMinor: catMap[b.category] ?? b.spentMinor,
      varianceMinor: b.amountMinor - (catMap[b.category] ?? b.spentMinor),
      utilizationPercent: b.amountMinor ? Math.round(((catMap[b.category] ?? 0) / b.amountMinor) * 100) : 0,
    }));
    res.json({ success: true, data: overview });
  } catch (e) { next(e); }
});

financeEnhancementsRouter.get("/income-expense", requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [rev] = await db.select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(payments)
      .where(and(eq(payments.tenantId, tenant.id), isNull(payments.deletedAt)));
    const [exp] = await db.select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(eq(expenses.tenantId, tenant.id));
    const [don] = await db.select({ total: sql<number>`coalesce(sum(${donations.amountMinor}), 0)` }).from(donations).where(eq(donations.tenantId, tenant.id));
    const recentExpenses = await db.select().from(expenses).where(eq(expenses.tenantId, tenant.id)).orderBy(desc(expenses.spentAt)).limit(20);
    const recentDonations = await db.select().from(donations).where(eq(donations.tenantId, tenant.id)).orderBy(desc(donations.receivedAt)).limit(10);
    res.json({
      success: true,
      data: {
        incomeMinor: Number(rev?.total ?? 0) + Number(don?.total ?? 0),
        feeIncomeMinor: Number(rev?.total ?? 0),
        donationsMinor: Number(don?.total ?? 0),
        expensesMinor: Number(exp?.total ?? 0),
        netMinor: Number(rev?.total ?? 0) + Number(don?.total ?? 0) - Number(exp?.total ?? 0),
        recentExpenses,
        recentDonations,
      },
    });
  } catch (e) { next(e); }
});

financeEnhancementsRouter.patch("/fee-heads/:id", requirePermission("finance.invoice.create"),
  validate({ body: z.object({ feeType: z.string().optional(), name: z.string().optional(), description: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.update(feeHeads).set(req.body).where(and(eq(feeHeads.id, req.params.id), eq(feeHeads.tenantId, tenant.id))).returning();
      if (!row) throw new NotFoundError("Fee head not found");
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

export default financeEnhancementsRouter;
