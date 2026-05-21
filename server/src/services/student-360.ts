import { db } from "../db";
import {
  students, invoices, payments, disciplineIncidents, boardingAllocations, boardingRooms, boardingHouses,
  routeAssignments, transportRoutes, studentClassHistory, classes, marks, assessments,
  healthFlags, sickbayVisits,
} from "../db/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";

export async function getStudent360(tenantId: string, studentId: string) {
  const [student] = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId))).limit(1);
  if (!student) return null;

  const feeHistory = await db.select().from(invoices).where(and(
    eq(invoices.studentId, studentId), eq(invoices.tenantId, tenantId), isNull(invoices.deletedAt),
  )).orderBy(desc(invoices.createdAt)).limit(20);

  const feePayments = await db.select().from(payments).where(and(
    eq(payments.studentId, studentId), eq(payments.tenantId, tenantId), isNull(payments.deletedAt),
  )).orderBy(desc(payments.paidAt)).limit(20);

  const discipline = await db.select().from(disciplineIncidents).where(and(
    eq(disciplineIncidents.studentId, studentId), eq(disciplineIncidents.tenantId, tenantId),
  )).orderBy(desc(disciplineIncidents.incidentDate)).limit(15);

  const [hostel] = await db.select({
    room: boardingRooms.name,
    house: boardingHouses.name,
    fromDate: boardingAllocations.fromDate,
  }).from(boardingAllocations)
    .innerJoin(boardingRooms, eq(boardingAllocations.roomId, boardingRooms.id))
    .innerJoin(boardingHouses, eq(boardingRooms.houseId, boardingHouses.id))
    .where(and(eq(boardingAllocations.studentId, studentId), eq(boardingAllocations.tenantId, tenantId), isNull(boardingAllocations.toDate)))
    .limit(1);

  const [transport] = await db.select({
    routeName: transportRoutes.name,
  }).from(routeAssignments)
    .innerJoin(transportRoutes, eq(routeAssignments.routeId, transportRoutes.id))
    .where(and(eq(routeAssignments.studentId, studentId), eq(routeAssignments.tenantId, tenantId)))
    .limit(1);

  const classHistory = await db.select({
    id: studentClassHistory.id,
    className: classes.name,
    enrolledAt: studentClassHistory.fromDate,
  }).from(studentClassHistory)
    .innerJoin(classes, eq(studentClassHistory.classId, classes.id))
    .where(eq(studentClassHistory.studentId, studentId))
    .orderBy(desc(studentClassHistory.fromDate))
    .limit(10);

  const gradeRows = await db.select({
    assessmentTitle: assessments.name,
    score: marks.score,
    maxScore: assessments.maxScore,
  }).from(marks)
    .innerJoin(assessments, eq(marks.assessmentId, assessments.id))
    .where(and(eq(marks.studentId, studentId), eq(marks.tenantId, tenantId)))
    .orderBy(desc(assessments.createdAt))
    .limit(12);

  const avgScore = gradeRows.length
    ? gradeRows.reduce((s, g) => s + (g.maxScore && g.score != null ? (g.score / g.maxScore) * 100 : 0), 0) / gradeRows.length
    : null;

  const health = await db.select().from(healthFlags).where(and(
    eq(healthFlags.studentId, studentId), eq(healthFlags.tenantId, tenantId), eq(healthFlags.active, true),
  ));

  const clinicVisits = await db.select().from(sickbayVisits).where(and(
    eq(sickbayVisits.studentId, studentId), eq(sickbayVisits.tenantId, tenantId),
  )).orderBy(desc(sickbayVisits.visitDate)).limit(5);

  return {
    student,
    medical: (student as any).medicalJson ?? {},
    biometricId: (student as any).biometricId ?? null,
    feeHistory,
    feePayments,
    discipline,
    hostel: hostel ?? null,
    transport: transport ?? null,
    classHistory,
    analytics: { averagePercent: avgScore, gradeCount: gradeRows.length, grades: gradeRows },
    health,
    clinicVisits,
  };
}

