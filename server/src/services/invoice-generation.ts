import { db } from "../db";
import {
  feeStructureItems, feeStructures, invoices, invoiceItems, studentClassHistory, students,
  studentFeeConcessions, feeConcessionPolicies, recurringFeeSchedules, feeDiscounts,
} from "../db/schema";
import { eq, and, isNull, or, sql } from "drizzle-orm";

export async function computeStudentConcessionMinor(
  tenantId: string,
  studentId: string,
  baseMinor: number,
  termId?: string | null,
): Promise<{ discountMinor: number; details: string[] }> {
  const conditions = [
    eq(studentFeeConcessions.tenantId, tenantId),
    eq(studentFeeConcessions.studentId, studentId),
    eq(studentFeeConcessions.status, "active"),
  ];
  if (termId) {
    conditions.push(or(eq(studentFeeConcessions.termId, termId), isNull(studentFeeConcessions.termId))!);
  }
  const rows = await db.select({
    concession: studentFeeConcessions,
    policyName: feeConcessionPolicies.name,
    policyPercent: feeConcessionPolicies.percent,
    policyAmount: feeConcessionPolicies.amountMinor,
  }).from(studentFeeConcessions)
    .leftJoin(feeConcessionPolicies, eq(studentFeeConcessions.policyId, feeConcessionPolicies.id))
    .where(and(...conditions));

  let discountMinor = 0;
  const details: string[] = [];
  for (const r of rows) {
    const pct = r.concession.percent ?? r.policyPercent;
    const amt = r.concession.amountMinor ?? r.policyAmount;
    if (pct) {
      const d = Math.round(baseMinor * (pct / 100));
      discountMinor += d;
      details.push(`${r.policyName ?? "Concession"}: ${pct}% (-${d})`);
    } else if (amt) {
      discountMinor += amt;
      details.push(`${r.policyName ?? "Concession"}: -${amt}`);
    }
  }
  return { discountMinor: Math.min(discountMinor, baseMinor), details };
}

/** Student-scoped discounts without a fixed invoice (applied at generation). */
export async function computeStudentDiscountMinor(
  tenantId: string,
  studentId: string,
  baseMinor: number,
): Promise<{ discountMinor: number; details: string[] }> {
  const rows = await db.select().from(feeDiscounts).where(and(
    eq(feeDiscounts.tenantId, tenantId),
    isNull(feeDiscounts.invoiceId),
    or(eq(feeDiscounts.studentId, studentId), isNull(feeDiscounts.studentId))!,
  ));

  let discountMinor = 0;
  const details: string[] = [];
  for (const d of rows) {
    if (d.percent) {
      const amt = Math.round(baseMinor * (d.percent / 100));
      discountMinor += amt;
      details.push(`${d.name}: ${d.percent}% (-${amt})`);
    } else if (d.amountMinor) {
      discountMinor += d.amountMinor;
      details.push(`${d.name}: -${d.amountMinor}`);
    }
  }
  return { discountMinor: Math.min(discountMinor, baseMinor), details };
}

export async function computeInvoiceAdjustments(
  tenantId: string,
  studentId: string,
  baseMinor: number,
  termId?: string | null,
): Promise<{ totalMinor: number; concessionMinor: number; discountMinor: number; details: string[] }> {
  const { discountMinor: concessionMinor, details: cDetails } = await computeStudentConcessionMinor(tenantId, studentId, baseMinor, termId);
  const afterConcession = Math.max(0, baseMinor - concessionMinor);
  const { discountMinor: discountOnRemainder, details: dDetails } = await computeStudentDiscountMinor(tenantId, studentId, afterConcession);
  const discountMinor = concessionMinor + discountOnRemainder;
  return {
    totalMinor: Math.max(0, baseMinor - discountMinor),
    concessionMinor,
    discountMinor: discountOnRemainder,
    details: [...cDetails, ...dDetails],
  };
}

export async function generateInvoicesFromStructure(opts: {
  tenantId: string;
  feeStructureId: string;
  termId: string;
  classId: string;
  dueDate?: Date;
  skipExistingForTerm?: boolean;
}): Promise<{ created: typeof invoices.$inferSelect[]; skipped: number }> {
  const [fs] = await db.select().from(feeStructures).where(and(
    eq(feeStructures.id, opts.feeStructureId),
    eq(feeStructures.tenantId, opts.tenantId),
    isNull(feeStructures.deletedAt),
  )).limit(1);
  if (!fs) throw new Error("Fee structure not found");

  const items = await db.select().from(feeStructureItems).where(and(
    eq(feeStructureItems.feeStructureId, fs.id),
    eq(feeStructureItems.tenantId, opts.tenantId),
  ));
  const baseTotal = items.reduce((s, i) => s + i.amount, 0);

  const enrolled = await db.select({ studentId: studentClassHistory.studentId })
    .from(studentClassHistory)
    .innerJoin(students, eq(students.id, studentClassHistory.studentId))
    .where(and(
      eq(studentClassHistory.tenantId, opts.tenantId),
      eq(studentClassHistory.classId, opts.classId),
      isNull(studentClassHistory.toDate),
      isNull(students.deletedAt),
    ));

  const created: typeof invoices.$inferSelect[] = [];
  let skipped = 0;
  let seq = Date.now();

  for (const { studentId } of enrolled) {
    if (opts.skipExistingForTerm) {
      const [existing] = await db.select({ id: invoices.id }).from(invoices).where(and(
        eq(invoices.tenantId, opts.tenantId),
        eq(invoices.studentId, studentId),
        eq(invoices.termId, opts.termId),
        isNull(invoices.deletedAt),
      )).limit(1);
      if (existing) {
        skipped++;
        continue;
      }
    }

    const { totalMinor: total } = await computeInvoiceAdjustments(opts.tenantId, studentId, baseTotal, opts.termId);
    const invoiceNo = `INV-${++seq}`;
    const [inv] = await db.insert(invoices).values({
      tenantId: opts.tenantId,
      studentId,
      termId: opts.termId,
      invoiceNo,
      totalAmount: total,
      status: "unpaid",
      dueDate: opts.dueDate,
    }).returning();
    if (items.length) {
      await db.insert(invoiceItems).values(items.map((i) => ({
        tenantId: opts.tenantId,
        invoiceId: inv.id,
        feeHeadId: i.feeHeadId,
        description: "Fee",
        amount: i.amount,
      })));
    }
    created.push(inv);
  }

  return { created, skipped };
}

export async function runDueRecurringSchedules(tenantId: string): Promise<{ schedulesRun: number; invoicesCreated: number }> {
  const now = new Date();
  const due = await db.select().from(recurringFeeSchedules).where(and(
    eq(recurringFeeSchedules.tenantId, tenantId),
    eq(recurringFeeSchedules.enabled, true),
    sql`(${recurringFeeSchedules.nextRunAt} IS NULL OR ${recurringFeeSchedules.nextRunAt} <= ${now})`,
  ));

  let invoicesCreated = 0;
  for (const sched of due) {
    if (!sched.classId || !sched.termId) continue;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (sched.dueDaysAfter ?? 14));
    const { created } = await generateInvoicesFromStructure({
      tenantId,
      feeStructureId: sched.feeStructureId,
      termId: sched.termId,
      classId: sched.classId,
      dueDate,
      skipExistingForTerm: true,
    });
    invoicesCreated += created.length;
    const next = new Date();
    if (sched.frequency === "monthly") next.setMonth(next.getMonth() + 1);
    else if (sched.frequency === "annual") next.setFullYear(next.getFullYear() + 1);
    else next.setMonth(next.getMonth() + 4);
    await db.update(recurringFeeSchedules).set({ lastRunAt: now, nextRunAt: next }).where(eq(recurringFeeSchedules.id, sched.id));
  }
  return { schedulesRun: due.length, invoicesCreated };
}
