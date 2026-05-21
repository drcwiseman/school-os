import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { payrollRuns, payrollItems, payslips, staff, staffContracts, payrollTaxRules } from "../db/schema";
import { computePayrollDeductions } from "../services/payroll-compute";
import { eq, and, desc, isNull } from "drizzle-orm";
import { softDeletePayrollRun } from "../services/soft-delete";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError, BadRequestError } from "../middleware/error";
import { createAuditLog } from "../services/audit";
import { generatePayslipPdf } from "../services/pdf";

function sendPdf(res: any, bytes: Uint8Array, filename: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(bytes));
}

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/runs", ...guard, requirePermission("payroll.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await db.select().from(payrollRuns).where(and(eq(payrollRuns.tenantId, tenant.id), isNull(payrollRuns.deletedAt))).orderBy(desc(payrollRuns.createdAt)) });
  } catch (e) { next(e); }
});

router.get("/runs/:id", ...guard, requirePermission("payroll.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [run] = await db.select().from(payrollRuns).where(and(
      eq(payrollRuns.id, req.params.id),
      eq(payrollRuns.tenantId, tenant.id),
      isNull(payrollRuns.deletedAt),
    )).limit(1);
    if (!run) throw new NotFoundError("Payroll run not found");
    const items = await db
      .select({
        id: payrollItems.id,
        staffId: payrollItems.staffId,
        grossPay: payrollItems.grossPay,
        deductions: payrollItems.deductions,
        netPay: payrollItems.netPay,
        employeeNo: staff.employeeNo,
        firstName: staff.firstName,
        lastName: staff.lastName,
      })
      .from(payrollItems)
      .innerJoin(staff, eq(payrollItems.staffId, staff.id))
      .where(and(
        eq(payrollItems.payrollRunId, run.id),
        eq(payrollItems.tenantId, tenant.id),
        isNull(payrollItems.deletedAt),
      ));
    res.json({ success: true, data: { run, items } });
  } catch (e) { next(e); }
});

router.post("/runs", ...guard, requirePermission("payroll.run"),
  validate({ body: z.object({ period: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [run] = await db.insert(payrollRuns).values({ tenantId: tenant.id, period: req.body.period, status: "draft" }).returning();
      const staffList = await db.select().from(staff).where(and(eq(staff.tenantId, tenant.id), eq(staff.status, "active"), isNull(staff.deletedAt)));
      const taxRules = await db.select().from(payrollTaxRules).where(eq(payrollTaxRules.tenantId, tenant.id));
      const items = [];
      for (const s of staffList) {
        const [contract] = await db.select().from(staffContracts).where(and(
          eq(staffContracts.staffId, s.id), eq(staffContracts.tenantId, tenant.id),
        )).orderBy(desc(staffContracts.startDate)).limit(1);
        const gross = contract?.salary ?? 0;
        const { deductionsMinor, netPayMinor, breakdown } = computePayrollDeductions(
          gross,
          taxRules.map((r) => ({ name: r.name, ratePercent: r.ratePercent, thresholdMinor: r.thresholdMinor })),
        );
        const [item] = await db.insert(payrollItems).values({
          tenantId: tenant.id,
          payrollRunId: run.id,
          staffId: s.id,
          grossPay: gross,
          deductions: deductionsMinor,
          netPay: netPayMinor,
          deductionsJson: { breakdown },
        }).returning();
        items.push(item);
      }
      res.status(201).json({ success: true, data: { run, items } });
    } catch (e) { next(e); }
  }
);

router.post("/runs/:id/approve", ...guard, requirePermission("payroll.approve"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [run] = await db.update(payrollRuns).set({ status: "approved", approvedBy: user.id }).where(and(eq(payrollRuns.id, req.params.id), eq(payrollRuns.tenantId, tenant.id))).returning();
    if (!run) throw new NotFoundError("Payroll run not found");
    const items = await db.select().from(payrollItems).where(and(eq(payrollItems.payrollRunId, run.id), eq(payrollItems.tenantId, tenant.id)));
    const slips = [];
    for (const item of items) {
      const [s] = await db.select().from(staff).where(eq(staff.id, item.staffId)).limit(1);
      const dj = (item.deductionsJson ?? {}) as { breakdown?: { name: string; amountMinor: number }[] };
      const [slip] = await db.insert(payslips).values({
        tenantId: tenant.id, payrollItemId: item.id, staffId: item.staffId,
        dataJson: {
          period: run.period,
          gross: item.grossPay,
          deductions: item.deductions,
          net: item.netPay,
          employee: s?.employeeNo,
          breakdown: dj.breakdown ?? [],
        },
      }).returning();
      slips.push(slip);
    }
    await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "payroll.approve", entityType: "payroll_run", entityId: run.id, after: run, ip: req.ip });
    res.json({ success: true, data: { run, payslips: slips } });
  } catch (e) { next(e); }
});

router.post("/runs/:id/mark-paid", ...guard, requirePermission("payroll.approve"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [before] = await db.select().from(payrollRuns).where(and(
      eq(payrollRuns.id, req.params.id),
      eq(payrollRuns.tenantId, tenant.id),
      isNull(payrollRuns.deletedAt),
    )).limit(1);
    if (!before) throw new NotFoundError("Payroll run not found");
    if (before.status !== "approved") {
      throw new BadRequestError("Only approved payroll runs can be marked paid");
    }
    const [run] = await db.update(payrollRuns).set({ status: "paid" }).where(eq(payrollRuns.id, before.id)).returning();
    await createAuditLog({
      tenantId: tenant.id, actorUserId: user.id, action: "payroll.mark_paid",
      entityType: "payroll_run", entityId: run!.id, before, after: run, ip: req.ip,
    });
    res.json({ success: true, data: run });
  } catch (e) { next(e); }
});

router.delete("/runs/:id", ...guard, requirePermission("payroll.run"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const [before] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, req.params.id), eq(payrollRuns.tenantId, tenant.id), isNull(payrollRuns.deletedAt))).limit(1);
    if (!before) throw new NotFoundError("Payroll run not found");
    const updated = await softDeletePayrollRun(tenant.id, req.params.id, user.id);
    await createAuditLog({ tenantId: tenant.id, actorUserId: user.id, action: "payroll_run.void", entityType: "payroll_run", entityId: before.id, before, after: updated, ip: req.ip });
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get("/payslips", ...guard, requirePermission("payroll.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const rows = await db
      .select({
        id: payslips.id,
        staffId: payslips.staffId,
        issuedAt: payslips.issuedAt,
        dataJson: payslips.dataJson,
        employeeNo: staff.employeeNo,
        firstName: staff.firstName,
        lastName: staff.lastName,
      })
      .from(payslips)
      .innerJoin(staff, eq(payslips.staffId, staff.id))
      .where(eq(payslips.tenantId, tenant.id))
      .orderBy(desc(payslips.issuedAt));
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.patch("/runs/:runId/items/:itemId", ...guard, requirePermission("payroll.run"),
  validate({ body: z.object({
    grossPay: z.number().int().optional(),
    extraDeductions: z.array(z.object({ name: z.string(), amountMinor: z.number().int() })).optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [existing] = await db.select().from(payrollItems).where(and(
        eq(payrollItems.id, req.params.itemId),
        eq(payrollItems.payrollRunId, req.params.runId),
        eq(payrollItems.tenantId, tenant.id),
        isNull(payrollItems.deletedAt),
      )).limit(1);
      if (!existing) throw new NotFoundError("Payroll item not found");
      const [run] = await db.select().from(payrollRuns).where(and(
        eq(payrollRuns.id, req.params.runId), eq(payrollRuns.tenantId, tenant.id), eq(payrollRuns.status, "draft"),
      )).limit(1);
      if (!run) throw new BadRequestError("Can only edit items on draft payroll runs");

      const gross = req.body.grossPay ?? existing.grossPay;
      const taxRules = await db.select().from(payrollTaxRules).where(eq(payrollTaxRules.tenantId, tenant.id));
      const { deductionsMinor, netPayMinor, breakdown } = computePayrollDeductions(
        gross,
        taxRules.map((r) => ({ name: r.name, ratePercent: r.ratePercent, thresholdMinor: r.thresholdMinor })),
        req.body.extraDeductions ?? [],
      );
      const [row] = await db.update(payrollItems).set({
        grossPay: gross,
        deductions: deductionsMinor,
        netPay: netPayMinor,
        deductionsJson: { breakdown, extra: req.body.extraDeductions ?? [] },
      }).where(eq(payrollItems.id, existing.id)).returning();
      res.json({ success: true, data: row });
    } catch (e) { next(e); }
  },
);

router.get("/payslips/:id/pdf", ...guard, requirePermission("payroll.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [slip] = await db.select().from(payslips).where(and(
      eq(payslips.id, req.params.id),
      eq(payslips.tenantId, tenant.id),
    )).limit(1);
    if (!slip) throw new NotFoundError("Payslip not found");
    const bytes = await generatePayslipPdf(tenant.id, slip.id);
    sendPdf(res, bytes, `payslip-${slip.id.slice(0, 8)}.pdf`);
  } catch (e) { next(e); }
});

export default router;
