import { db } from "../db";
import { students, users, invoices, payments, marks, payrollRuns, payrollItems } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { BadRequestError, NotFoundError } from "../middleware/error";

/** Soft-delete a student (finance/audit safe — never hard-delete). */
export async function softDeleteStudent(tenantId: string, studentId: string, deletedBy: string) {
  const [row] = await db
    .update(students)
    .set({
      deletedAt: new Date(),
      deletedBy,
      status: "inactive",
      updatedAt: new Date(),
    })
    .where(and(
      eq(students.id, studentId),
      eq(students.tenantId, tenantId),
      isNull(students.deletedAt),
    ))
    .returning();
  if (!row) throw new NotFoundError("Student not found or already deleted");
  return row;
}

export async function softDeleteStaffUser(tenantId: string, userId: string, deletedBy: string) {
  const [row] = await db
    .update(users)
    .set({
      deletedAt: new Date(),
      deletedBy,
      status: "inactive",
      updatedAt: new Date(),
    })
    .where(and(
      eq(users.id, userId),
      eq(users.tenantId, tenantId),
      isNull(users.deletedAt),
    ))
    .returning();
  if (!row) throw new NotFoundError("User not found or already deleted");
  return row;
}

export async function softDeleteInvoice(tenantId: string, invoiceId: string, deletedBy: string) {
  const [row] = await db
    .update(invoices)
    .set({ deletedAt: new Date(), deletedBy, updatedAt: new Date() })
    .where(and(
      eq(invoices.id, invoiceId),
      eq(invoices.tenantId, tenantId),
      isNull(invoices.deletedAt),
    ))
    .returning();
  if (!row) throw new NotFoundError("Invoice not found or already deleted");
  return row;
}

export async function softDeletePayment(tenantId: string, paymentId: string, deletedBy: string) {
  const [row] = await db
    .update(payments)
    .set({ deletedAt: new Date(), deletedBy })
    .where(and(
      eq(payments.id, paymentId),
      eq(payments.tenantId, tenantId),
      isNull(payments.deletedAt),
    ))
    .returning();
  if (!row) throw new NotFoundError("Payment not found or already deleted");
  return row;
}

/** Void payment: reverse invoice allocation, then soft-delete payment record. */
export async function voidPayment(tenantId: string, paymentId: string, voidedBy: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(
      eq(payments.id, paymentId),
      eq(payments.tenantId, tenantId),
      isNull(payments.deletedAt),
    ))
    .limit(1);
  if (!payment) throw new NotFoundError("Payment not found or already voided");

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, payment.invoiceId), eq(invoices.tenantId, tenantId), isNull(invoices.deletedAt)))
    .limit(1);
  if (!invoice) throw new NotFoundError("Linked invoice not found");

  const newPaid = Math.max(0, invoice.paidAmount - payment.amount);
  const status = newPaid >= invoice.totalAmount ? "paid" : newPaid > 0 ? "partial" : "unpaid";

  const [updatedInvoice] = await db
    .update(invoices)
    .set({ paidAmount: newPaid, status, updatedAt: new Date() })
    .where(eq(invoices.id, invoice.id))
    .returning();

  const voided = await softDeletePayment(tenantId, paymentId, voidedBy);
  return { payment: voided, invoice: updatedInvoice };
}

export async function softDeleteMark(tenantId: string, markId: string, deletedBy: string) {
  const [row] = await db
    .update(marks)
    .set({ deletedAt: new Date(), deletedBy, updatedAt: new Date() })
    .where(and(eq(marks.id, markId), eq(marks.tenantId, tenantId), isNull(marks.deletedAt)))
    .returning();
  if (!row) throw new NotFoundError("Mark not found or already deleted");
  return row;
}

/** Cancel a payroll run (draft/pending only) and soft-delete its line items. */
export async function softDeletePayrollRun(tenantId: string, runId: string, deletedBy: string) {
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.tenantId, tenantId), isNull(payrollRuns.deletedAt)))
    .limit(1);
  if (!run) throw new NotFoundError("Payroll run not found or already deleted");
  if (run.status === "approved" || run.status === "paid") {
    throw new BadRequestError("Cannot void an approved or paid payroll run");
  }

  const now = new Date();
  await db
    .update(payrollItems)
    .set({ deletedAt: now, deletedBy })
    .where(and(eq(payrollItems.payrollRunId, run.id), eq(payrollItems.tenantId, tenantId), isNull(payrollItems.deletedAt)));

  const [row] = await db
    .update(payrollRuns)
    .set({ deletedAt: now, deletedBy })
    .where(eq(payrollRuns.id, run.id))
    .returning();
  return row!;
}
