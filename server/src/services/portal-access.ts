import { db } from "../db";
import { portalAccounts, studentGuardians, students } from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "../middleware/error";

export type PortalAccount = typeof portalAccounts.$inferSelect;

/** Parent: student IDs this portal account may access */
export async function getParentAccessibleStudentIds(account: PortalAccount): Promise<string[]> {
  if (account.type !== "parent" || !account.guardianId) {
    throw new ForbiddenError("Invalid parent portal account");
  }
  const links = await db
    .select({ studentId: studentGuardians.studentId })
    .from(studentGuardians)
    .where(eq(studentGuardians.guardianId, account.guardianId));
  return links.map((l) => l.studentId);
}

/** Student: only own student id */
export function getStudentAccessibleStudentIds(account: PortalAccount): string[] {
  if (account.type !== "student" || !account.studentId) {
    throw new ForbiddenError("Invalid student portal account");
  }
  return [account.studentId];
}

export async function getPortalAccessibleStudentIds(account: PortalAccount): Promise<string[]> {
  return account.type === "parent"
    ? getParentAccessibleStudentIds(account)
    : getStudentAccessibleStudentIds(account);
}

/** IDOR guard: portal user may only access this student within tenant */
export async function assertPortalCanAccessStudent(
  account: PortalAccount,
  tenantId: string,
  studentId: string,
): Promise<void> {
  const allowed = await getPortalAccessibleStudentIds(account);
  if (!allowed.includes(studentId)) {
    throw new ForbiddenError("You do not have access to this student");
  }
  const [row] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.tenantId, tenantId)))
    .limit(1);
  if (!row) throw new NotFoundError("Student not found");
}

export async function filterStudentsForPortal(
  account: PortalAccount,
  tenantId: string,
): Promise<typeof students.$inferSelect[]> {
  const ids = await getPortalAccessibleStudentIds(account);
  if (ids.length === 0) return [];
  return db
    .select()
    .from(students)
    .where(and(eq(students.tenantId, tenantId), inArray(students.id, ids)));
}
