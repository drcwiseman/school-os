import { db } from "../db";
import { students, studentClassHistory } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";

/** Active students enrolled in a class (current class history row only). */
export async function rosterStudentIdsForClass(
  tenantId: string,
  classId: string,
  streamId?: string | null,
): Promise<string[]> {
  const conditions = [
    eq(studentClassHistory.tenantId, tenantId),
    eq(studentClassHistory.classId, classId),
    isNull(studentClassHistory.toDate),
    eq(students.status, "active"),
  ];
  if (streamId) conditions.push(eq(studentClassHistory.streamId, streamId));

  const rows = await db
    .select({ id: students.id })
    .from(studentClassHistory)
    .innerJoin(students, eq(students.id, studentClassHistory.studentId))
    .where(and(...conditions));

  return rows.map((r) => r.id);
}

/** Parse YYYY-MM-DD as local noon to avoid timezone day shifts in DB comparisons. */
export function parseAttendanceDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) throw new Error("Invalid date");
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}
