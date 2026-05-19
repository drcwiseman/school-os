import { db } from "../db";
import { students, users, invoices, payments } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { NotFoundError } from "../middleware/error";

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
