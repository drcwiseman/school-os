import { db } from "../db";
import { examAcademicGroupMembers } from "../db/schema";
import { eq, and } from "drizzle-orm";

export async function getAcademicGroupStudentIds(tenantId: string, academicGroupId: string): Promise<Set<string>> {
  const rows = await db.select({ memberId: examAcademicGroupMembers.memberId }).from(examAcademicGroupMembers).where(and(
    eq(examAcademicGroupMembers.tenantId, tenantId),
    eq(examAcademicGroupMembers.groupId, academicGroupId),
    eq(examAcademicGroupMembers.memberType, "student"),
  ));
  return new Set(rows.map((r) => r.memberId));
}
