import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  feeHeads, feeStructures, feeStructureItems, invoices, invoiceItems,
  payments, paymentAllocations, receipts, expenses, students, studentClassHistory,
  installmentPlans, feeDiscounts, feeSponsorships, financeRefunds,
  chartOfAccounts, journalEntries, journalLines, budgets, tenantSettings,
} from "../db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { getCampusId, pushCampusFilter } from "../lib/campus-scope";
import { softDeleteInvoice, voidPayment, softDeleteFeeStructure } from "../services/soft-delete";
import { nextReceiptNumber } from "../utils/receipts";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError, ConflictError } from "../middleware/error";
import { createAuditLog } from "../services/audit";
import { paginationSchema, paginate, paginatedResponse } from "../utils/pagination";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/fee-heads", ...guard, requirePermission("finance.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db.select().from(feeHeads).where(eq(feeHeads.tenantId, tenant.id));
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/fee-heads", ...guard, requirePermission("finance.invoice.create"),
  validate({ body: z.object({ name: z.string().min(1), description: z.string().optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(feeHeads).values({ tenantId: tenant.id, name: req.body.name, description: req.body.description }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  }
);

router.get("/invoices", ...guard, requirePermission("finance.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const q = await paginationSchema.parseAsync(req.query);
    const { limit, offset } = paginate(q.page, q.limit);
    const active = and(eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt));
    const rows = await db.select().from(invoices).where(active).orderBy(desc(invoices.createdAt)).limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(active);
    res.json(paginatedResponse(rows, Number(count), q.page, q.limit));
  } catch (err) { next(err); }
});

router.post("/invoices", ...guard, requirePermission("finance.invoice.create"),
  validate({ body: z.object({ studentId: z.string().uuid(), termId: z.string().uuid().optional(), invoiceNo: z.string().min(1), totalAmount: z.number().int().positive(), dueDate: z.string().optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [student] = await db.select().from(students).where(and(eq(students.id, req.body.studentId), eq(students.tenantId, tenant.id))).limit(1);
      if (!student) throw new NotFoundError("Student not found");
      const [existing] = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenant.id), eq(invoices.invoiceNo, req.body.invoiceNo))).limit(1);
      if (existing) throw new ConflictError("Invoice number already exists");
      const [invoice] = await db.insert(invoices).values({
        tenantId: tenant.id,
        campusId: student.campusId ?? undefined,
        studentId: req.body.studentId,
        termId: req.body.termId,
        invoiceNo: req.body.invoiceNo,
        totalAmount: req.body.totalAmount,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        status: "unpaid",
      }).returning();
      await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "invoice.create", entityType: "invoice", entityId: invoice.id, after: invoice, ip: req.ip });
      res.status(201).json({ success: true, data: invoice });
    } catch (err) { next(err); }
  }
);

router.get("/fee-structures", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(feeStructures).where(and(eq(feeStructures.tenantId, tenant.id), isNull(feeStructures.deletedAt))) });
  } catch (e) { next(e); }
});

router.get("/fee-structures/:id", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [fs] = await db.select().from(feeStructures).where(and(
      eq(feeStructures.id, req.params.id),
      eq(feeStructures.tenantId, tenant.id),
      isNull(feeStructures.deletedAt),
    )).limit(1);
    if (!fs) throw new NotFoundError("Fee structure not found");
    const items = await db
      .select({
        id: feeStructureItems.id,
        amount: feeStructureItems.amount,
        feeHeadId: feeStructureItems.feeHeadId,
        feeHeadName: feeHeads.name,
      })
      .from(feeStructureItems)
      .innerJoin(feeHeads, eq(feeStructureItems.feeHeadId, feeHeads.id))
      .where(and(eq(feeStructureItems.feeStructureId, fs.id), eq(feeStructureItems.tenantId, tenant.id)));
    const total = items.reduce((s, i) => s + i.amount, 0);
    res.json({ success: true, data: { ...fs, items, total } });
  } catch (e) { next(e); }
});

router.post("/fee-structures", ...guard, requirePermission("finance.invoice.create"),
  validate({ body: z.object({ name: z.string(), termId: z.string().uuid().optional(), classId: z.string().uuid().optional(), items: z.array(z.object({ feeHeadId: z.string().uuid(), amount: z.number().int() })) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [fs] = await db.insert(feeStructures).values({ tenantId: tenant.id, name: req.body.name, termId: req.body.termId, classId: req.body.classId }).returning();
      if (req.body.items?.length) {
        await db.insert(feeStructureItems).values(req.body.items.map((i: any) => ({ tenantId: tenant.id, feeStructureId: fs.id, feeHeadId: i.feeHeadId, amount: i.amount })));
      }
      res.status(201).json({ success: true, data: fs });
    } catch (e) { next(e); }
  }
);

router.delete("/fee-structures/:id", ...guard, requirePermission("finance.invoice.create"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [before] = await db.select().from(feeStructures).where(and(eq(feeStructures.id, req.params.id), eq(feeStructures.tenantId, tenant.id), isNull(feeStructures.deletedAt))).limit(1);
    if (!before) throw new NotFoundError("Fee structure not found");
    const updated = await softDeleteFeeStructure(tenant.id, req.params.id, user.id);
    await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "fee_structure.soft_delete", entityType: "fee_structure", entityId: before.id, before, after: updated, ip: req.ip });
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post("/invoices/bulk", ...guard, requirePermission("finance.invoice.create"),
  validate({ body: z.object({ termId: z.string().uuid(), classId: z.string().uuid(), feeStructureId: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const items = await db.select().from(feeStructureItems).where(and(eq(feeStructureItems.feeStructureId, req.body.feeStructureId), eq(feeStructureItems.tenantId, tenant.id)));
      const total = items.reduce((s, i) => s + i.amount, 0);
      const enrolled = await db.select({ studentId: studentClassHistory.studentId }).from(studentClassHistory).where(and(eq(studentClassHistory.tenantId, tenant.id), eq(studentClassHistory.classId, req.body.classId)));
      const created = [];
      let seq = Date.now();
      for (const { studentId } of enrolled) {
        const invoiceNo = `INV-${++seq}`;
        const [inv] = await db.insert(invoices).values({ tenantId: tenant.id, studentId, termId: req.body.termId, invoiceNo, totalAmount: total, status: "unpaid" }).returning();
        await db.insert(invoiceItems).values(items.map(i => ({ tenantId: tenant.id, invoiceId: inv.id, feeHeadId: i.feeHeadId, description: "Fee", amount: i.amount })));
        created.push(inv);
      }
      await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "invoice.bulk_create", entityType: "invoice", after: { count: created.length }, ip: req.ip });
      res.status(201).json({ success: true, data: created });
    } catch (e) { next(e); }
  }
);

router.post("/payments", ...guard, requirePermission("finance.payment.create"),
  validate({ body: z.object({ invoiceId: z.string().uuid(), amount: z.number().int().positive(), method: z.string().default("cash"), reference: z.string().optional() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, req.body.invoiceId), eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt))).limit(1);
      if (!invoice) throw new NotFoundError("Invoice not found");
      const receiptNo = await nextReceiptNumber(tenant.id);
      const [payment] = await db.insert(payments).values({
        tenantId: tenant.id, invoiceId: invoice.id, studentId: invoice.studentId,
        amount: req.body.amount, method: req.body.method, reference: req.body.reference, receiptNo, createdBy: user.id,
      }).returning();
      await db.insert(paymentAllocations).values({ tenantId: tenant.id, paymentId: payment.id, invoiceId: invoice.id, amount: req.body.amount });
      const [receipt] = await db.insert(receipts).values({ tenantId: tenant.id, paymentId: payment.id, receiptNo, amount: req.body.amount }).returning();
      const newPaid = invoice.paidAmount + req.body.amount;
      const status = newPaid >= invoice.totalAmount ? "paid" : newPaid > 0 ? "partial" : "unpaid";
      const [updatedInvoice] = await db.update(invoices).set({ paidAmount: newPaid, status, updatedAt: new Date() }).where(eq(invoices.id, invoice.id)).returning();
      await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "payment.create", entityType: "payment", entityId: payment.id, after: { payment, receipt }, ip: req.ip });
      res.status(201).json({ success: true, data: { payment, receipt, invoice: updatedInvoice } });
    } catch (err) { next(err); }
  }
);

router.get("/payments", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const active = and(eq(payments.tenantId, tenant.id), isNull(payments.deletedAt));
    const rows = await db.select().from(payments).where(active).orderBy(desc(payments.paidAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.post("/payments/:id/void", ...guard, requirePermission("finance.refund.create"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [before] = await db.select().from(payments).where(and(eq(payments.id, req.params.id), eq(payments.tenantId, tenant.id), isNull(payments.deletedAt))).limit(1);
    if (!before) throw new NotFoundError("Payment not found");
    const result = await voidPayment(tenant.id, req.params.id, user.id);
    await createAuditLog({
      tenantId: tenant.id, actorUserId: user.id, action: "payment.void",
      entityType: "payment", entityId: before.id, before, after: result, ip: req.ip,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get("/debtors", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const conditions = [eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt), sql`${invoices.paidAmount} < ${invoices.totalAmount}`];
    pushCampusFilter(conditions, invoices, req);
    const rows = await db.select().from(invoices).where(and(...conditions)).orderBy(desc(invoices.dueDate));
    const withBalance = rows.map(r => ({ ...r, balance: r.totalAmount - r.paidAmount }));
    res.json({ success: true, data: withBalance });
  } catch (e) { next(e); }
});

router.get("/receipts", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(receipts).where(eq(receipts.tenantId, tenant.id)).orderBy(desc(receipts.issuedAt)) });
  } catch (e) { next(e); }
});

router.get("/expenses", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(expenses).where(eq(expenses.tenantId, tenant.id)).orderBy(desc(expenses.spentAt)) });
  } catch (e) { next(e); }
});

router.post("/expenses", ...guard, requirePermission("finance.payment.create"),
  validate({ body: z.object({ description: z.string(), amount: z.number().int().positive(), category: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(expenses).values({ tenantId: tenant.id, description: req.body.description, amount: req.body.amount, category: req.body.category, createdBy: user.id }).returning();
      await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "expense.create", entityType: "expense", entityId: row.id, after: row, ip: req.ip });
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  }
);

router.get("/dashboard", ...guard, requirePermission("finance.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const [stats] = await db.select({
      totalInvoiced: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
      totalPaid: sql<number>`coalesce(sum(${invoices.paidAmount}), 0)`,
      unpaidCount: sql<number>`count(*) filter (where ${invoices.status} = 'unpaid')`,
    }).from(invoices).where(and(eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt)));
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

router.delete("/invoices/:id", ...guard, requirePermission("finance.invoice.create"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [before] = await db.select().from(invoices).where(and(eq(invoices.id, req.params.id), eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt))).limit(1);
    if (!before) throw new NotFoundError("Invoice not found");
    const updated = await softDeleteInvoice(tenant.id, req.params.id, user.id);
    await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "invoice.soft_delete", entityType: "invoice", entityId: before.id, before, after: updated, ip: req.ip });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post("/payments/gateway/initiate", ...guard, requirePermission("finance.payment.create"),
  validate({
    body: z.object({
      invoiceId: z.string().uuid(),
      provider: z.enum(["flutterwave", "mtn_momo"]),
      payerPhone: z.string().optional(),
      customerEmail: z.string().email().optional(),
      customerName: z.string().optional(),
      redirectUrl: z.string().url().optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenant = (req as any).tenant;
      const [invoice] = await db.select().from(invoices).where(and(
        eq(invoices.id, req.body.invoiceId),
        eq(invoices.tenantId, tenant.id),
        isNull(invoices.deletedAt),
      )).limit(1);
      if (!invoice) throw new NotFoundError("Invoice not found");
      const balance = invoice.totalAmount - invoice.paidAmount;
      if (balance <= 0) throw new ConflictError("Invoice is already paid");

      const base = (process.env.CLIENT_ORIGIN || "").replace(/\/$/, "");
      const redirectUrl = req.body.redirectUrl || `${base}/s/${tenant.slug}/finance`;

      const { initiateFlutterwavePayment, initiateMtnMomoCollection } = await import("../services/integration-runtime");

      const amountMajor = balance / 100;

      if (req.body.provider === "flutterwave") {
        const result = await initiateFlutterwavePayment({
          tenantId: tenant.id,
          invoiceId: invoice.id,
          amount: amountMajor,
          customerEmail: req.body.customerEmail || "payer@school.local",
          customerName: req.body.customerName || "Parent",
          redirectUrl,
        });
        if (!result.ok) return res.status(400).json({ success: false, message: result.message });
        return res.json({ success: true, data: result });
      }

      if (!req.body.payerPhone) {
        return res.status(400).json({ success: false, message: "payerPhone required for MTN MoMo" });
      }
      const result = await initiateMtnMomoCollection({
        tenantId: tenant.id,
        invoiceId: invoice.id,
        amount: amountMajor,
        payerPhone: req.body.payerPhone,
      });
      if (!result.ok) return res.status(400).json({ success: false, message: result.message });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

router.post("/installments", ...guard, requirePermission("finance.invoice.create"),
  validate({ body: z.object({ invoiceId: z.string().uuid(), installments: z.array(z.object({ dueDate: z.string(), amountMinor: z.number().int().positive() })) }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(installmentPlans).values({
        tenantId: tenant.id,
        invoiceId: req.body.invoiceId,
        installmentsJson: req.body.installments,
      }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/installments/:invoiceId", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.select().from(installmentPlans).where(and(eq(installmentPlans.invoiceId, req.params.invoiceId), eq(installmentPlans.tenantId, tenant.id))).limit(1);
    res.json({ success: true, data: row ?? null });
  } catch (e) { next(e); }
});

router.post("/discounts", ...guard, requirePermission("finance.invoice.create"),
  validate({ body: z.object({ name: z.string(), studentId: z.string().uuid().optional(), invoiceId: z.string().uuid().optional(), percent: z.number().optional(), amountMinor: z.number().optional(), reason: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(feeDiscounts).values({ tenantId: tenant.id, ...req.body }).returning();
      if (req.body.invoiceId && req.body.amountMinor) {
        const [inv] = await db.select().from(invoices).where(eq(invoices.id, req.body.invoiceId)).limit(1);
        if (inv) await db.update(invoices).set({ totalAmount: Math.max(0, inv.totalAmount - req.body.amountMinor) }).where(eq(invoices.id, inv.id));
      }
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/discounts", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(feeDiscounts).where(eq(feeDiscounts.tenantId, tenant.id)).orderBy(desc(feeDiscounts.createdAt)) });
  } catch (e) { next(e); }
});

router.post("/sponsorships", ...guard, requirePermission("finance.invoice.create"),
  validate({ body: z.object({ studentId: z.string().uuid(), sponsorName: z.string(), amountMinor: z.number().int().positive(), termId: z.string().uuid().optional(), notes: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(feeSponsorships).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/sponsorships", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(feeSponsorships).where(eq(feeSponsorships.tenantId, tenant.id)).orderBy(desc(feeSponsorships.createdAt)) });
  } catch (e) { next(e); }
});

router.get("/arrears-aging", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const now = new Date();
    const rows = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt), sql`${invoices.paidAmount} < ${invoices.totalAmount}`));
    const buckets = { current: [] as any[], d30: [] as any[], d60: [] as any[], d90: [] as any[] };
    for (const inv of rows) {
      const balance = inv.totalAmount - inv.paidAmount;
      const due = inv.dueDate ? new Date(inv.dueDate) : now;
      const days = Math.floor((now.getTime() - due.getTime()) / 86400000);
      const item = { ...inv, balance, daysOverdue: Math.max(0, days) };
      if (days <= 0) buckets.current.push(item);
      else if (days <= 30) buckets.d30.push(item);
      else if (days <= 60) buckets.d60.push(item);
      else buckets.d90.push(item);
    }
    res.json({ success: true, data: buckets });
  } catch (e) { next(e); }
});

router.post("/refunds", ...guard, requirePermission("finance.refund.create"),
  validate({ body: z.object({ paymentId: z.string().uuid(), amountMinor: z.number().int().positive(), reason: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [row] = await db.insert(financeRefunds).values({ tenantId: tenant.id, ...req.body, createdBy: user.id }).returning();
      await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "refund.request", entityType: "finance_refund", entityId: row.id, after: row, ip: req.ip });
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/refunds", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(financeRefunds).where(eq(financeRefunds.tenantId, tenant.id)).orderBy(desc(financeRefunds.createdAt)) });
  } catch (e) { next(e); }
});

router.get("/accounts", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/accounts", ...guard, requirePermission("finance.payment.create"),
  validate({ body: z.object({ code: z.string(), name: z.string(), accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]).optional() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(chartOfAccounts).values({ tenantId: tenant.id, code: req.body.code, name: req.body.name, accountType: req.body.accountType ?? "asset" }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.post("/journal", ...guard, requirePermission("finance.payment.create"),
  validate({
    body: z.object({
      entryDate: z.string(),
      description: z.string(),
      reference: z.string().optional(),
      lines: z.array(z.object({ accountId: z.string().uuid(), debitMinor: z.number().int().default(0), creditMinor: z.number().int().default(0) })).min(2),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const debit = req.body.lines.reduce((s: number, l: any) => s + l.debitMinor, 0);
      const credit = req.body.lines.reduce((s: number, l: any) => s + l.creditMinor, 0);
      if (debit !== credit) return res.status(400).json({ success: false, message: "Debits must equal credits" });
      const [entry] = await db.insert(journalEntries).values({
        tenantId: tenant.id,
        entryDate: req.body.entryDate,
        description: req.body.description,
        reference: req.body.reference,
        createdBy: user.id,
      }).returning();
      await db.insert(journalLines).values(req.body.lines.map((l: any) => ({ tenantId: tenant.id, entryId: entry.id, ...l })));
      res.status(201).json({ success: true, data: entry });
    } catch (e) { next(e); }
  },
);

router.get("/ledger", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const lines = await db.select({
      entryDate: journalEntries.entryDate,
      description: journalEntries.description,
      accountCode: chartOfAccounts.code,
      accountName: chartOfAccounts.name,
      debitMinor: journalLines.debitMinor,
      creditMinor: journalLines.creditMinor,
    }).from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalLines.accountId, chartOfAccounts.id))
      .where(eq(journalLines.tenantId, tenant.id))
      .orderBy(desc(journalEntries.entryDate));
    res.json({ success: true, data: lines });
  } catch (e) { next(e); }
});

router.get("/budgets", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(budgets).where(eq(budgets.tenantId, tenant.id)) });
  } catch (e) { next(e); }
});

router.post("/budgets", ...guard, requirePermission("finance.payment.create"),
  validate({ body: z.object({ fiscalYear: z.number(), category: z.string(), amountMinor: z.number().int().positive() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [row] = await db.insert(budgets).values({ tenantId: tenant.id, ...req.body }).returning();
      res.status(201).json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/statements", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [inv] = await db.select({
      revenue: sql<number>`coalesce(sum(${invoices.paidAmount}), 0)`,
      invoiced: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
    }).from(invoices).where(and(eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt)));
    const [exp] = await db.select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(eq(expenses.tenantId, tenant.id));
    const net = Number(inv?.revenue ?? 0) - Number(exp?.total ?? 0);
    res.json({
      success: true,
      data: {
        profitAndLoss: { revenueMinor: Number(inv?.revenue ?? 0), expensesMinor: Number(exp?.total ?? 0), netMinor: net },
        balanceSheet: { assetsMinor: Number(inv?.revenue ?? 0), liabilitiesMinor: Number(inv?.invoiced ?? 0) - Number(inv?.revenue ?? 0) },
      },
    });
  } catch (e) { next(e); }
});

router.get("/command-center", ...guard, requirePermission("finance.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [dash] = await db.select({
      totalInvoiced: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
      totalPaid: sql<number>`coalesce(sum(${invoices.paidAmount}), 0)`,
      unpaidCount: sql<number>`count(*) filter (where ${invoices.status} = 'unpaid')`,
      overdueCount: sql<number>`count(*) filter (where ${invoices.dueDate} < now() and ${invoices.paidAmount} < ${invoices.totalAmount})`,
    }).from(invoices).where(and(eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt)));
    const [refundPending] = await db.select({ count: sql<number>`count(*)` }).from(financeRefunds).where(and(eq(financeRefunds.tenantId, tenant.id), eq(financeRefunds.status, "pending")));
    res.json({ success: true, data: { ...dash, pendingRefunds: Number(refundPending?.count ?? 0) } });
  } catch (e) { next(e); }
});

router.post("/apply-late-penalties", ...guard, requirePermission("finance.invoice.create"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
    const pct = settings?.latePenaltyPercent ?? 0;
    if (!pct) return res.json({ success: true, data: { applied: 0 } });
    const overdue = await db.select().from(invoices).where(and(
      eq(invoices.tenantId, tenant.id),
      isNull(invoices.deletedAt),
      sql`${invoices.dueDate} < now()`,
      sql`${invoices.paidAmount} < ${invoices.totalAmount}`,
    ));
    let applied = 0;
    for (const inv of overdue) {
      const penalty = Math.round(inv.totalAmount * (pct / 100));
      await db.update(invoices).set({ totalAmount: inv.totalAmount + penalty }).where(eq(invoices.id, inv.id));
      applied++;
    }
    res.json({ success: true, data: { applied, penaltyPercent: pct } });
  } catch (e) { next(e); }
});

export default router;
