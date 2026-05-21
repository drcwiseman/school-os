import { db } from "../db";
import {
  students, classes, streams, assessments, assignments,
  attendanceSessions, attendanceRecords, invoices, payments, expenses,
  payrollRuns, transportRoutes, routeAssignments, boardingRooms, boardingAllocations,
  libraryLoans, sickbayVisits, healthFlags, inventoryItems,
  announcements, deliveryLogs, teacherAssignments, marks,
  staffAttendance, portalMessages,
} from "../db/schema";
import { eq, and, sql, isNull, gte, lt, lte, desc, SQL } from "drizzle-orm";
import { analyzeDropoutRisk } from "./ai-agents";
import { campusCondition } from "../lib/campus-scope";
import { safeDb } from "../lib/safe-db";

export type CommandCenterKpis = {
  academic: {
    totalStudents: number;
    activeStudents: number;
    attendanceSessionsToday: number;
    attendancePresentToday: number;
    attendanceRateToday: number | null;
    activeClasses: number;
    activeStreams: number;
    ongoingExams: number;
    upcomingAssignments: number;
    atRiskStudents: number;
    teacherAssignments: number;
    staffPresentToday: number;
    staffTotalToday: number;
  };
  finance: {
    feesCollectedTodayMinor: number;
    outstandingBalanceMinor: number;
    pendingInvoices: number;
    payrollDue: number;
    expensesTodayMinor: number;
    expensesMonthMinor: number;
  };
  operations: {
    transportRoutes: number;
    transportAssignments: number;
    hostelRooms: number;
    hostelOccupied: number;
    hostelOccupancyPct: number | null;
    libraryActiveLoans: number;
    libraryOverdue: number;
    clinicOpenVisits: number;
    healthAlerts: number;
    inventoryLowStock: number;
  };
  communication: {
    recentAnnouncements: number;
    smsSentToday: number;
    smsFailedToday: number;
    upcomingEvents: number;
    unreadParentMessages: number;
  };
  aiInsights: {
    atRiskPreview: Array<{ studentId: string; name: string; riskScore: number; status: string }>;
    feeDefaultRiskCount: number;
    attendanceAnomalySessions: number;
    overloadedTeachers: number;
  };
};

function dayBounds() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  return { startOfDay, endOfDay };
}

function emptyCommandCenterKpis(): CommandCenterKpis {
  return {
    academic: {
      totalStudents: 0, activeStudents: 0, attendanceSessionsToday: 0, attendancePresentToday: 0,
      attendanceRateToday: null, activeClasses: 0, activeStreams: 0, ongoingExams: 0, upcomingAssignments: 0,
      atRiskStudents: 0, teacherAssignments: 0, staffPresentToday: 0, staffTotalToday: 0,
    },
    finance: {
      feesCollectedTodayMinor: 0, outstandingBalanceMinor: 0, pendingInvoices: 0, payrollDue: 0,
      expensesTodayMinor: 0, expensesMonthMinor: 0,
    },
    operations: {
      transportRoutes: 0, transportAssignments: 0, hostelRooms: 0, hostelOccupied: 0, hostelOccupancyPct: null,
      libraryActiveLoans: 0, libraryOverdue: 0, clinicOpenVisits: 0, healthAlerts: 0, inventoryLowStock: 0,
    },
    communication: {
      recentAnnouncements: 0, smsSentToday: 0, smsFailedToday: 0, upcomingEvents: 0, unreadParentMessages: 0,
    },
    aiInsights: {
      atRiskPreview: [], feeDefaultRiskCount: 0, attendanceAnomalySessions: 0, overloadedTeachers: 0,
    },
  };
}

export async function buildCommandCenterKpis(tenantId: string, campusId?: string): Promise<CommandCenterKpis> {
  return safeDb("command-center", emptyCommandCenterKpis(), () => buildCommandCenterKpisInner(tenantId, campusId));
}

async function buildCommandCenterKpisInner(tenantId: string, campusId?: string): Promise<CommandCenterKpis> {
  const { startOfDay, endOfDay } = dayBounds();
  const inSevenDays = new Date();
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  const studentWhere = [eq(students.tenantId, tenantId), isNull(students.deletedAt)];
  const cStu = campusCondition(students, campusId);
  if (cStu) studentWhere.push(cStu);

  const [studentStats] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${students.status} = 'active')`,
    })
    .from(students)
    .where(and(...studentWhere));

  const classWhere = [eq(classes.tenantId, tenantId)];
  const cCls = campusCondition(classes, campusId);
  if (cCls) classWhere.push(cCls);

  const [classStats] = await db
    .select({ classes: sql<number>`count(distinct ${classes.id})`, streams: sql<number>`count(distinct ${streams.id})` })
    .from(classes)
    .leftJoin(streams, and(eq(streams.classId, classes.id), eq(streams.tenantId, tenantId)))
    .where(and(...classWhere));

  const ongoingExams = await db
    .select({ count: sql<number>`count(*)` })
    .from(assessments)
    .where(and(
      eq(assessments.tenantId, tenantId),
      isNull(assessments.deletedAt),
      sql`(${assessments.deadline} is null or ${assessments.deadline} >= ${startOfDay})`,
    ));

  const upcomingAssignments = await db
    .select({ count: sql<number>`count(*)` })
    .from(assignments)
    .where(and(
      eq(assignments.tenantId, tenantId),
      gte(assignments.dueDate, startOfDay),
      lte(assignments.dueDate, inSevenDays),
    ));

  const [attendanceToday] = await db
    .select({
      sessions: sql<number>`count(distinct ${attendanceSessions.id})`,
      present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')`,
      total: sql<number>`count(*)`,
    })
    .from(attendanceSessions)
    .leftJoin(attendanceRecords, eq(attendanceRecords.sessionId, attendanceSessions.id))
    .where(and(
      eq(attendanceSessions.tenantId, tenantId),
      gte(attendanceSessions.date, startOfDay),
      lt(attendanceSessions.date, endOfDay),
    ));

  const paymentConds = [
    eq(payments.tenantId, tenantId),
    isNull(payments.deletedAt),
    gte(payments.paidAt, startOfDay),
    lt(payments.paidAt, endOfDay),
  ];
  const [financeToday] = campusId
    ? await db
      .select({ collected: sql<number>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(and(...paymentConds, eq(invoices.campusId, campusId)))
    : await db
      .select({ collected: sql<number>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(and(...paymentConds));

  const invoiceWhere = [eq(invoices.tenantId, tenantId), isNull(invoices.deletedAt)];
  const cInv = campusCondition(invoices, campusId);
  if (cInv) invoiceWhere.push(cInv);

  const [outstanding] = await db
    .select({
      balance: sql<number>`coalesce(sum(${invoices.totalAmount} - ${invoices.paidAmount}), 0)`,
      pending: sql<number>`count(*) filter (where ${invoices.paidAmount} < ${invoices.totalAmount})`,
    })
    .from(invoices)
    .where(and(...invoiceWhere));

  const [payrollDue] = await db
    .select({ count: sql<number>`count(*)` })
    .from(payrollRuns)
    .where(and(
      eq(payrollRuns.tenantId, tenantId),
      sql`${payrollRuns.status} in ('draft', 'pending_approval')`,
    ));

  const monthStart = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
  const [expenseStats] = await db
    .select({
      today: sql<number>`coalesce(sum(${expenses.amount}) filter (where ${expenses.spentAt} >= ${startOfDay}), 0)`,
      month: sql<number>`coalesce(sum(${expenses.amount}) filter (where ${expenses.spentAt} >= ${monthStart}), 0)`,
    })
    .from(expenses)
    .where(eq(expenses.tenantId, tenantId));

  const [routeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transportRoutes)
    .where(eq(transportRoutes.tenantId, tenantId));

  const [assignmentCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(routeAssignments)
    .where(eq(routeAssignments.tenantId, tenantId));

  const [hostelStats] = await db
    .select({
      rooms: sql<number>`count(distinct ${boardingRooms.id})`,
      occupied: sql<number>`count(distinct ${boardingAllocations.roomId})`,
    })
    .from(boardingRooms)
    .leftJoin(boardingAllocations, and(
      eq(boardingAllocations.roomId, boardingRooms.id),
      eq(boardingAllocations.tenantId, tenantId),
      isNull(boardingAllocations.toDate),
    ))
    .where(eq(boardingRooms.tenantId, tenantId));

  const now = new Date();
  const [libraryStats] = await db
    .select({
      active: sql<number>`count(*) filter (where ${libraryLoans.returnedAt} is null)`,
      overdue: sql<number>`count(*) filter (where ${libraryLoans.returnedAt} is null and ${libraryLoans.dueAt} < ${now})`,
    })
    .from(libraryLoans)
    .where(eq(libraryLoans.tenantId, tenantId));

  const [clinicStats] = await db
    .select({
      openVisits: sql<number>`count(*) filter (where ${sickbayVisits.dischargedAt} is null)`,
    })
    .from(sickbayVisits)
    .where(eq(sickbayVisits.tenantId, tenantId));

  const [healthAlertCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(healthFlags)
    .where(and(eq(healthFlags.tenantId, tenantId), eq(healthFlags.active, true)));

  const [lowStock] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.tenantId, tenantId), sql`${inventoryItems.quantity} <= 5`));

  const [commStats] = await db
    .select({
      announcements: sql<number>`count(*) filter (where ${announcements.published} = true)`,
      upcoming: sql<number>`count(*) filter (where ${announcements.publishAt} > ${now})`,
    })
    .from(announcements)
    .where(eq(announcements.tenantId, tenantId));

  const [smsToday] = await db
    .select({
      sent: sql<number>`count(*) filter (where ${deliveryLogs.status} = 'sent')`,
      failed: sql<number>`count(*) filter (where ${deliveryLogs.status} = 'failed')`,
    })
    .from(deliveryLogs)
    .where(and(
      eq(deliveryLogs.tenantId, tenantId),
      gte(deliveryLogs.createdAt, startOfDay),
      lt(deliveryLogs.createdAt, endOfDay),
    ));

  const teacherRows = await db
    .select({ userId: teacherAssignments.userId })
    .from(teacherAssignments)
    .where(eq(teacherAssignments.tenantId, tenantId));
  const loadByTeacher = new Map<string, number>();
  for (const row of teacherRows) {
    loadByTeacher.set(row.userId, (loadByTeacher.get(row.userId) ?? 0) + 1);
  }
  const overloadedTeachers = [...loadByTeacher.values()].filter((n) => n > 5).length;

  const todayStr = startOfDay.toISOString().slice(0, 10);
  const [staffToday] = await db
    .select({
      present: sql<number>`count(*) filter (where ${staffAttendance.status} = 'present')`,
      total: sql<number>`count(*)`,
    })
    .from(staffAttendance)
    .where(and(eq(staffAttendance.tenantId, tenantId), eq(staffAttendance.date, todayStr)));

  const [unreadParent] = await db
    .select({ count: sql<number>`count(*)` })
    .from(portalMessages)
    .where(and(eq(portalMessages.tenantId, tenantId), eq(portalMessages.senderType, "parent"), isNull(portalMessages.readAt)));

  const atRiskPreview = await computeAtRiskPreview(tenantId, 5, campusId);
  const atRiskTotal = atRiskPreview.length;
  const feeDefaultRiskCount = await countFeeDefaultRisk(tenantId, campusId);
  const attendanceAnomalySessions = await countAttendanceAnomalies(tenantId);

  const totalAtt = Number(attendanceToday?.total ?? 0);
  const presentAtt = Number(attendanceToday?.present ?? 0);
  const rooms = Number(hostelStats?.rooms ?? 0);
  const occupied = Number(hostelStats?.occupied ?? 0);

  return {
    academic: {
      totalStudents: Number(studentStats?.total ?? 0),
      activeStudents: Number(studentStats?.active ?? 0),
      attendanceSessionsToday: Number(attendanceToday?.sessions ?? 0),
      attendancePresentToday: presentAtt,
      attendanceRateToday: totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : null,
      activeClasses: Number(classStats?.classes ?? 0),
      activeStreams: Number(classStats?.streams ?? 0),
      ongoingExams: Number(ongoingExams[0]?.count ?? 0),
      upcomingAssignments: Number(upcomingAssignments[0]?.count ?? 0),
      atRiskStudents: atRiskTotal,
      teacherAssignments: teacherRows.length,
      staffPresentToday: Number(staffToday?.present ?? 0),
      staffTotalToday: Number(staffToday?.total ?? 0),
    },
    finance: {
      feesCollectedTodayMinor: Number(financeToday?.collected ?? 0),
      outstandingBalanceMinor: Number(outstanding?.balance ?? 0),
      pendingInvoices: Number(outstanding?.pending ?? 0),
      payrollDue: Number(payrollDue?.count ?? 0),
      expensesTodayMinor: Number(expenseStats?.today ?? 0),
      expensesMonthMinor: Number(expenseStats?.month ?? 0),
    },
    operations: {
      transportRoutes: Number(routeCount?.count ?? 0),
      transportAssignments: Number(assignmentCount?.count ?? 0),
      hostelRooms: rooms,
      hostelOccupied: occupied,
      hostelOccupancyPct: rooms > 0 ? Math.round((occupied / rooms) * 100) : null,
      libraryActiveLoans: Number(libraryStats?.active ?? 0),
      libraryOverdue: Number(libraryStats?.overdue ?? 0),
      clinicOpenVisits: Number(clinicStats?.openVisits ?? 0),
      healthAlerts: Number(healthAlertCount?.count ?? 0),
      inventoryLowStock: Number(lowStock?.count ?? 0),
    },
    communication: {
      recentAnnouncements: Number(commStats?.announcements ?? 0),
      smsSentToday: Number(smsToday?.sent ?? 0),
      smsFailedToday: Number(smsToday?.failed ?? 0),
      upcomingEvents: Number(commStats?.upcoming ?? 0),
      unreadParentMessages: Number(unreadParent?.count ?? 0),
    },
    aiInsights: {
      atRiskPreview,
      feeDefaultRiskCount,
      attendanceAnomalySessions,
      overloadedTeachers,
    },
  };
}

async function computeAtRiskPreview(tenantId: string, limit: number, campusId?: string) {
  const where = [eq(students.tenantId, tenantId), eq(students.status, "active"), isNull(students.deletedAt)];
  const c = campusCondition(students, campusId);
  if (c) where.push(c);
  const activeStudents = await db
    .select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
    .from(students)
    .where(and(...where))
    .limit(50);

  const preview: CommandCenterKpis["aiInsights"]["atRiskPreview"] = [];

  for (const s of activeStudents) {
    const [att] = await db
      .select({
        present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')`,
        total: sql<number>`count(*)`,
      })
      .from(attendanceRecords)
      .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
      .where(and(eq(attendanceRecords.studentId, s.id), eq(attendanceSessions.tenantId, tenantId)));

    const [grade] = await db
      .select({ avg: sql<number>`coalesce(avg(${marks.score}), 0)` })
      .from(marks)
      .where(and(eq(marks.studentId, s.id), eq(marks.tenantId, tenantId), isNull(marks.deletedAt)));

    const [fees] = await db
      .select({ due: sql<number>`coalesce(sum(${invoices.totalAmount} - ${invoices.paidAmount}), 0)` })
      .from(invoices)
      .where(and(eq(invoices.studentId, s.id), eq(invoices.tenantId, tenantId), isNull(invoices.deletedAt)));

    const total = Number(att?.total ?? 0);
    const rate = total > 0 ? Number(att?.present ?? 0) / total : 1;
    const risk = await analyzeDropoutRisk(rate, Number(grade?.avg ?? 0), Number(fees?.due ?? 0));
    if (risk.status !== "low") {
      preview.push({
        studentId: s.id,
        name: `${s.firstName} ${s.lastName}`,
        riskScore: risk.riskScore,
        status: risk.status,
      });
    }
  }

  return preview.sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
}

async function countFeeDefaultRisk(tenantId: string, campusId?: string) {
  const where = [
    eq(invoices.tenantId, tenantId),
    isNull(invoices.deletedAt),
    sql`${invoices.paidAmount} < ${invoices.totalAmount}`,
    sql`${invoices.dueDate} < now()`,
  ];
  const c = campusCondition(invoices, campusId);
  if (c) where.push(c);
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${invoices.studentId})` })
    .from(invoices)
    .where(and(...where));
  return Number(row?.count ?? 0);
}

async function countAttendanceAnomalies(tenantId: string) {
  const sessions = await db
    .select({ id: attendanceSessions.id })
    .from(attendanceSessions)
    .where(eq(attendanceSessions.tenantId, tenantId))
    .orderBy(desc(attendanceSessions.date))
    .limit(20);

  let anomalies = 0;
  for (const sess of sessions) {
    const [stats] = await db
      .select({
        absent: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'absent')`,
        total: sql<number>`count(*)`,
      })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.sessionId, sess.id));
    const total = Number(stats?.total ?? 0);
    if (total > 0 && Number(stats?.absent ?? 0) / total > 0.3) anomalies++;
  }
  return anomalies;
}
