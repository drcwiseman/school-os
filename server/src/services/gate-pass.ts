import { db } from "../db";
import { studentClassHistory, classes, streams, gatePasses } from "../db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

export async function resolveStudentPlacement(tenantId: string, studentId: string) {
  const [row] = await db.select({
    classId: studentClassHistory.classId,
    streamId: studentClassHistory.streamId,
    className: classes.name,
    streamName: streams.name,
  }).from(studentClassHistory)
    .innerJoin(classes, eq(studentClassHistory.classId, classes.id))
    .leftJoin(streams, eq(studentClassHistory.streamId, streams.id))
    .where(and(
      eq(studentClassHistory.tenantId, tenantId),
      eq(studentClassHistory.studentId, studentId),
      isNull(studentClassHistory.toDate),
    ))
    .orderBy(desc(studentClassHistory.fromDate))
    .limit(1);
  return row ?? null;
}

export async function nextGatePassNumber(tenantId: string): Promise<string> {
  const [cnt] = await db.select({ n: sql<number>`count(*)` }).from(gatePasses).where(eq(gatePasses.tenantId, tenantId));
  const seq = Number(cnt?.n ?? 0) + 1;
  const y = new Date().getFullYear();
  return `GP-${y}-${String(seq).padStart(5, "0")}`;
}
