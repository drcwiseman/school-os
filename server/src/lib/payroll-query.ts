import { db } from "../db";
import { payrollItems, payrollRuns, payslips, payrollTaxRules, staff } from "../db/schema";
import { and, desc, eq, isNull, type SQL } from "drizzle-orm";
import { getTableColumns, tableExists } from "./table-columns";
import { listStaffForTenant } from "./staff-query";
import { listContractsForStaff } from "./hr-query";

async function payrollRunWhere(tenantId: string, extra: SQL[] = []) {
  const cols = await getTableColumns("payroll_runs");
  const conditions: SQL[] = [eq(payrollRuns.tenantId, tenantId), ...extra];
  if (cols.has("deleted_at")) conditions.push(isNull(payrollRuns.deletedAt));
  return conditions;
}

async function payrollItemWhere(tenantId: string, extra: SQL[] = []) {
  const cols = await getTableColumns("payroll_items");
  const conditions: SQL[] = [eq(payrollItems.tenantId, tenantId), ...extra];
  if (cols.has("deleted_at")) conditions.push(isNull(payrollItems.deletedAt));
  return conditions;
}

export async function assertPayrollTablesReady() {
  const runs = await tableExists("payroll_runs");
  const items = await tableExists("payroll_items");
  if (!runs || !items) {
    throw new Error("Payroll tables missing — run npm run db:repair on the server");
  }
}

export async function listPayrollRuns(tenantId: string) {
  if (!(await tableExists("payroll_runs"))) return [];
  return db
    .select()
    .from(payrollRuns)
    .where(and(...await payrollRunWhere(tenantId)))
    .orderBy(desc(payrollRuns.createdAt));
}

export async function getPayrollRunById(tenantId: string, runId: string) {
  if (!(await tableExists("payroll_runs"))) return null;
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(and(...await payrollRunWhere(tenantId, [eq(payrollRuns.id, runId)])))
    .limit(1);
  return run ?? null;
}

export async function listPayrollItemsForRun(tenantId: string, runId: string) {
  if (!(await tableExists("payroll_items"))) return [];
  return db
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
    .where(and(...await payrollItemWhere(tenantId, [eq(payrollItems.payrollRunId, runId)])));
}

export async function listPayslipsForTenant(tenantId: string) {
  if (!(await tableExists("payslips"))) return [];
  return db
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
    .where(eq(payslips.tenantId, tenantId))
    .orderBy(desc(payslips.issuedAt));
}

export async function listPayrollTaxRules(tenantId: string) {
  if (!(await tableExists("payroll_tax_rules"))) return [];
  return db.select().from(payrollTaxRules).where(eq(payrollTaxRules.tenantId, tenantId));
}

export async function activeStaffWithLatestContract(tenantId: string) {
  const staffList = await listStaffForTenant(tenantId);
  const active = staffList.filter((s) => (s.status ?? "active") === "active");
  const withContract = [];
  for (const s of active) {
    const contracts = await listContractsForStaff(tenantId, String(s.id));
    const open = contracts.find((c) => !c.endDate) ?? contracts[0];
    withContract.push({ staff: s, contract: open ?? null });
  }
  return withContract;
}

export async function insertPayrollItem(
  tenantId: string,
  runId: string,
  staffId: string,
  grossPay: number,
  deductions: number,
  netPay: number,
  breakdown: { name: string; amountMinor: number }[],
) {
  const cols = await getTableColumns("payroll_items");
  const values: Record<string, unknown> = {
    tenantId,
    payrollRunId: runId,
    staffId,
    grossPay,
    deductions,
    netPay,
  };
  if (cols.has("deductions_json")) {
    values.deductionsJson = { breakdown };
  }
  const [item] = await db.insert(payrollItems).values(values as never).returning();
  return item;
}

export async function updatePayrollItemAmounts(
  itemId: string,
  grossPay: number,
  deductions: number,
  netPay: number,
  breakdown: { name: string; amountMinor: number }[],
  extra?: { name: string; amountMinor: number }[],
) {
  const cols = await getTableColumns("payroll_items");
  const patch: Record<string, unknown> = { grossPay, deductions, netPay };
  if (cols.has("deductions_json")) {
    patch.deductionsJson = { breakdown, extra: extra ?? [] };
  }
  const [row] = await db.update(payrollItems).set(patch as never).where(eq(payrollItems.id, itemId)).returning();
  return row;
}

export async function softDeletePayrollRunSafe(tenantId: string, runId: string, deletedBy: string) {
  const run = await getPayrollRunById(tenantId, runId);
  if (!run) throw new Error("Payroll run not found or already deleted");
  if (run.status === "approved" || run.status === "paid") {
    throw new Error("Cannot void an approved or paid payroll run");
  }
  const now = new Date();
  const itemCols = await getTableColumns("payroll_items");
  if (itemCols.has("deleted_at")) {
    await db
      .update(payrollItems)
      .set({ deletedAt: now, deletedBy })
      .where(and(eq(payrollItems.payrollRunId, run.id), eq(payrollItems.tenantId, tenantId), isNull(payrollItems.deletedAt)));
  } else {
    await db.delete(payrollItems).where(and(eq(payrollItems.payrollRunId, run.id), eq(payrollItems.tenantId, tenantId)));
  }
  const runCols = await getTableColumns("payroll_runs");
  if (runCols.has("deleted_at")) {
    const [row] = await db.update(payrollRuns).set({ deletedAt: now, deletedBy }).where(eq(payrollRuns.id, run.id)).returning();
    return row!;
  }
  await db.delete(payrollRuns).where(eq(payrollRuns.id, run.id));
  return run;
}
