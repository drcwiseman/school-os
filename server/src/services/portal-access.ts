import { db } from "../db";
import { studentGuardians, students } from "../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "../middleware/error";
import type { PortalPrincipal } from "../middleware/portal-auth";

/** Parent: student IDs linked via guardian */
export async function getParentAccessibleStudentIds(guardianId: string): Promise<string[]> {
  const links = await db
    .select({ studentId: studentGuardians.studentId })
    .from(studentGuardians)
    .where(eq(studentGuardians.guardianId, guardianId));
  return links.map((l) => l.studentId);
}

export function getStudentAccessibleStudentIds(studentId: string): string[] {
  return [studentId];
}

export async function getPortalAccessibleStudentIds(principal: PortalPrincipal): Promise<string[]> {
  if (principal.kind === "parent") {
    return getParentAccessibleStudentIds(principal.account.guardianId);
  }
  return getStudentAccessibleStudentIds(principal.account.studentId);
}

export async function assertPortalCanAccessStudent(
  principal: PortalPrincipal,
  tenantId: string,
  studentId: string,
): Promise<void> {
  const allowed = await getPortalAccessibleStudentIds(principal);
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
  principal: PortalPrincipal,
  tenantId: string,
): Promise<typeof students.$inferSelect[]> {
  const ids = await getPortalAccessibleStudentIds(principal);
  if (ids.length === 0) return [];
  return db
    .select()
    .from(students)
    .where(and(eq(students.tenantId, tenantId), inArray(students.id, ids)));
}
