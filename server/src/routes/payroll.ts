import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { payrollRuns, payrollItems, payslips, staff } from "../db/schema";
import { computePayrollDeductions } from "../services/payroll-compute";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { NotFoundError, BadRequestError } from "../middleware/error";
import { createAuditLog } from "../services/audit";
import { generatePayslipPdf } from "../services/pdf";
import {
  assertPayrollTablesReady,
  getPayrollRunById,
  insertPayrollItem,
  listPayrollItemsForRun,
  listPayrollRuns,
  listPayrollTaxRules,
  listPayslipsForTenant,
  activeStaffWithLatestContract,
  softDeletePayrollRunSafe,
  updatePayrollItemAmounts,
} from "../lib/payroll-query";

function sendPdf(res: any, bytes: Uint8Array, filename: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(bytes));
}

function mapPayrollError(err: unknown, next: (e: unknown) => void) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("missing") || msg.includes("db:repair")) {
    next(new BadRequestError(msg));
    return true;
  }
  return false;
}

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/runs", ...guard, requirePermission("payroll.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await listPayrollRuns(tenant.id) });
  } catch (e) {
    if (!mapPayrollError(e, next)) next(e);
  }
});

router.get("/runs/:id", ...guard, requirePermission("payroll.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const run = await getPayrollRunById(tenant.id, req.params.id);
    if (!run) throw new NotFoundError("Payroll run not found");
    const items = await listPayrollItemsForRun(tenant.id, run.id);
    res.json({ success: true, data: { run, items } });
  } catch (e) {
    if (!mapPayrollError(e, next)) next(e);
  }
});

router.post("/runs", ...guard, requirePermission("payroll.run"),
  validate({ body: z.object({ period: z.string() }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      await assertPayrollTablesReady();
      const [run] = await db.insert(payrollRuns).values({
        tenantId: tenant.id,
        period: req.body.period,
        status: "draft",
      }).returning();
      const staffWithContracts = await activeStaffWithLatestContract(tenant.id);
      const taxRules = await listPayrollTaxRules(tenant.id);
      const items = [];
      for (const { staff: s, contract } of staffWithContracts) {
        const gross = contract?.salary ?? 0;
        const { deductionsMinor, netPayMinor, breakdown } = computePayrollDeductions(
          gross,
          taxRules.map((r) => ({ name: r.name, ratePercent: r.ratePercent, thresholdMinor: r.thresholdMinor })),
        );
        const item = await insertPayrollItem(
          tenant.id,
          run.id,
          String(s.id),
          gross,
          deductionsMinor,
          netPayMinor,
          breakdown,
        );
        items.push(item);
      }
      res.status(201).json({ success: true, data: { run, items, staffCount: staffWithContracts.length } });
    } catch (e) {
      if (!mapPayrollError(e, next)) next(e);
    }
  },
);

router.post("/runs/:id/approve", ...guard, requirePermission("payroll.approve"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    await assertPayrollTablesReady();
    const [run] = await db.update(payrollRuns).set({ status: "approved", approvedBy: user.id }).where(and(
      eq(payrollRuns.id, req.params.id),
      eq(payrollRuns.tenantId, tenant.id),
    )).returning();
    if (!run) throw new NotFoundError("Payroll run not found");
    const items = await db.select().from(payrollItems).where(and(
      eq(payrollItems.payrollRunId, run.id),
      eq(payrollItems.tenantId, tenant.id),
    ));
    const slips = [];
    for (const item of items) {
      const [s] = await db.select().from(staff).where(eq(staff.id, item.staffId)).limit(1);
      const dj = (item.deductionsJson ?? {}) as { breakdown?: { name: string; amountMinor: number }[] };
      const [slip] = await db.insert(payslips).values({
        tenantId: tenant.id,
        payrollItemId: item.id,
        staffId: item.staffId,
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
    await createAuditLog({
      tenantId: tenant.id,
      actorUserId: user.id,
      action: "payroll.approve",
      entityType: "payroll_run",
      entityId: run.id,
      after: run,
      ip: req.ip,
    });
    res.json({ success: true, data: { run, payslips: slips } });
  } catch (e) {
    if (!mapPayrollError(e, next)) next(e);
  }
});

router.post("/runs/:id/mark-paid", ...guard, requirePermission("payroll.approve"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const before = await getPayrollRunById(tenant.id, req.params.id);
    if (!before) throw new NotFoundError("Payroll run not found");
    if (before.status !== "approved") {
      throw new BadRequestError("Only approved payroll runs can be marked paid");
    }
    const [run] = await db.update(payrollRuns).set({ status: "paid" }).where(eq(payrollRuns.id, before.id)).returning();
    await createAuditLog({
      tenantId: tenant.id,
      actorUserId: user.id,
      action: "payroll.mark_paid",
      entityType: "payroll_run",
      entityId: run!.id,
      before,
      after: run,
      ip: req.ip,
    });
    res.json({ success: true, data: run });
  } catch (e) {
    if (!mapPayrollError(e, next)) next(e);
  }
});

router.delete("/runs/:id", ...guard, requirePermission("payroll.run"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const user = (req as any).user;
    const before = await getPayrollRunById(tenant.id, req.params.id);
    if (!before) throw new NotFoundError("Payroll run not found");
    const updated = await softDeletePayrollRunSafe(tenant.id, req.params.id, user.id);
    await createAuditLog({
      tenantId: tenant.id,
      actorUserId: user.id,
      action: "payroll_run.void",
      entityType: "payroll_run",
      entityId: before.id,
      before,
      after: updated,
      ip: req.ip,
    });
    res.json({ success: true });
  } catch (e) {
    if (mapPayrollError(e, next)) return;
    if (e instanceof Error && e.message.includes("Cannot void")) {
      next(new BadRequestError(e.message));
      return;
    }
    next(e);
  }
});

router.get("/payslips", ...guard, requirePermission("payroll.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await listPayslipsForTenant(tenant.id) });
  } catch (e) {
    if (!mapPayrollError(e, next)) next(e);
  }
});

router.patch("/runs/:runId/items/:itemId", ...guard, requirePermission("payroll.run"),
  validate({ body: z.object({
    grossPay: z.number().int().optional(),
    extraDeductions: z.array(z.object({ name: z.string(), amountMinor: z.number().int() })).optional(),
  }) }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      await assertPayrollTablesReady();
      const run = await getPayrollRunById(tenant.id, req.params.runId);
      if (!run || run.status !== "draft") {
        throw new BadRequestError("Can only edit items on draft payroll runs");
      }
      const items = await listPayrollItemsForRun(tenant.id, req.params.runId);
      const existing = items.find((i) => i.id === req.params.itemId);
      if (!existing) throw new NotFoundError("Payroll item not found");

      const gross = req.body.grossPay ?? existing.grossPay;
      const taxRules = await listPayrollTaxRules(tenant.id);
      const { deductionsMinor, netPayMinor, breakdown } = computePayrollDeductions(
        gross,
        taxRules.map((r) => ({ name: r.name, ratePercent: r.ratePercent, thresholdMinor: r.thresholdMinor })),
        req.body.extraDeductions ?? [],
      );
      const row = await updatePayrollItemAmounts(
        req.params.itemId,
        gross,
        deductionsMinor,
        netPayMinor,
        breakdown,
        req.body.extraDeductions,
      );
      res.json({ success: true, data: row });
    } catch (e) {
      if (!mapPayrollError(e, next)) next(e);
    }
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
