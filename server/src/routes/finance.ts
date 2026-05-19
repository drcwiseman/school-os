import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  feeHeads, feeStructures, feeStructureItems, invoices, invoiceItems,
  payments, paymentAllocations, receipts, expenses, students, studentClassHistory,
} from "../db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
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
    const rows = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenant.id), isNull(invoices.deletedAt), sql`${invoices.paidAmount} < ${invoices.totalAmount}`)).orderBy(desc(invoices.dueDate));
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

export default router;
