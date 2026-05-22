import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  academicYears,
  announcements,
  assignments,
  assignmentSubmissions,
  cbtPapers,
  classes,
  feeHeads,
  feeStructureItems,
  feeStructures,
  invoices,
  libraryBooks,
  libraryCards,
  libraryCopies,
  libraryLoans,
  reportCards,
  routeAssignments,
  schoolEvents,
  streams,
  studentClassHistory,
  subjects,
  terms,
  timetablePeriods,
  timetables,
  transportRoutes,
  transportStops,
  users,
} from "../db/schema";
import { promoteScheduledAnnouncements } from "./announcements";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function buildStudentPortalExtras(tenantId: string, studentId: string) {
  await promoteScheduledAnnouncements(tenantId);

  const [currentTerm] = await db.select().from(terms).where(and(
    eq(terms.tenantId, tenantId),
    eq(terms.isCurrent, true),
  )).limit(1);

  const [currentYear] = await db.select().from(academicYears).where(and(
    eq(academicYears.tenantId, tenantId),
    eq(academicYears.isCurrent, true),
  )).limit(1);

  const [enrollment] = await db.select({
    classId: studentClassHistory.classId,
    streamId: studentClassHistory.streamId,
    termId: studentClassHistory.termId,
    fromDate: studentClassHistory.fromDate,
    className: classes.name,
    streamName: streams.name,
  })
    .from(studentClassHistory)
    .leftJoin(classes, eq(classes.id, studentClassHistory.classId))
    .leftJoin(streams, eq(streams.id, studentClassHistory.streamId))
    .where(and(
      eq(studentClassHistory.studentId, studentId),
      eq(studentClassHistory.tenantId, tenantId),
      isNull(studentClassHistory.toDate),
    ))
    .orderBy(desc(studentClassHistory.fromDate))
    .limit(1);

  const statements = await db.select().from(invoices).where(and(
    eq(invoices.tenantId, tenantId),
    eq(invoices.studentId, studentId),
    isNull(invoices.deletedAt),
  )).orderBy(desc(invoices.createdAt));

  const feeByTerm: {
    termId: string | null;
    termName: string;
    totalMinor: number;
    paidMinor: number;
    remainingMinor: number;
    invoiceCount: number;
  }[] = [];
  const termMap = new Map<string | null, typeof feeByTerm[0]>();
  for (const inv of statements) {
    const key = inv.termId ?? null;
    let row = termMap.get(key);
    if (!row) {
      const [t] = key
        ? await db.select({ name: terms.name }).from(terms).where(eq(terms.id, key)).limit(1)
        : [null];
      row = {
        termId: key,
        termName: t?.name ?? "General",
        totalMinor: 0,
        paidMinor: 0,
        remainingMinor: 0,
        invoiceCount: 0,
      };
      termMap.set(key, row);
      feeByTerm.push(row);
    }
    row.totalMinor += inv.totalAmount;
    row.paidMinor += inv.paidAmount;
    row.remainingMinor += Math.max(0, inv.totalAmount - inv.paidAmount);
    row.invoiceCount += 1;
  }

  const publishedReportCards = await db.select().from(reportCards).where(and(
    eq(reportCards.tenantId, tenantId),
    eq(reportCards.studentId, studentId),
    eq(reportCards.published, true),
  )).orderBy(desc(reportCards.createdAt));

  const cbtExams = await db.select({
    id: cbtPapers.id,
    title: cbtPapers.title,
    durationMinutes: cbtPapers.durationMinutes,
    published: cbtPapers.published,
    createdAt: cbtPapers.createdAt,
  }).from(cbtPapers).where(and(
    eq(cbtPapers.tenantId, tenantId),
    eq(cbtPapers.published, true),
  )).orderBy(desc(cbtPapers.createdAt)).limit(30);

  const loanRows = await db.select({
    id: libraryLoans.id,
    loanedAt: libraryLoans.loanedAt,
    dueAt: libraryLoans.dueAt,
    returnedAt: libraryLoans.returnedAt,
    bookTitle: libraryBooks.title,
    bookAuthor: libraryBooks.author,
    barcode: libraryCopies.barcode,
  })
    .from(libraryLoans)
    .innerJoin(libraryCopies, eq(libraryLoans.copyId, libraryCopies.id))
    .innerJoin(libraryBooks, eq(libraryCopies.bookId, libraryBooks.id))
    .where(and(eq(libraryLoans.tenantId, tenantId), eq(libraryLoans.studentId, studentId)))
    .orderBy(desc(libraryLoans.loanedAt))
    .limit(25);

  const [libraryCard] = await db.select({
    id: libraryCards.id,
    cardNumber: libraryCards.cardNumber,
    status: libraryCards.status,
  }).from(libraryCards).where(and(
    eq(libraryCards.tenantId, tenantId),
    eq(libraryCards.studentId, studentId),
  )).limit(1);

  const activeLoans = loanRows.filter((l) => !l.returnedAt);
  const overdueLoans = activeLoans.filter((l) => l.dueAt && new Date(l.dueAt) < new Date());

  const [transport] = await db.select({
    routeId: routeAssignments.routeId,
    routeName: transportRoutes.name,
    stopId: routeAssignments.stopId,
  })
    .from(routeAssignments)
    .innerJoin(transportRoutes, eq(transportRoutes.id, routeAssignments.routeId))
    .where(and(eq(routeAssignments.tenantId, tenantId), eq(routeAssignments.studentId, studentId)))
    .limit(1);

  let routeStops: { name: string; orderNo: number }[] = [];
  if (transport?.routeId) {
    routeStops = await db.select({ name: transportStops.name, orderNo: transportStops.orderNo })
      .from(transportStops)
      .where(and(eq(transportStops.routeId, transport.routeId), eq(transportStops.tenantId, tenantId)))
      .orderBy(transportStops.orderNo);
  }

  const now = new Date();
  const calendarEvents = await db.select().from(schoolEvents).where(and(
    eq(schoolEvents.tenantId, tenantId),
    eq(schoolEvents.published, true),
  )).orderBy(schoolEvents.startsAt).limit(40);

  const upcoming = calendarEvents.filter((e) => !e.endsAt || e.endsAt >= now).slice(0, 20);

  const classId = enrollment?.classId ?? null;
  let schoolTermFees: {
    termId: string;
    termName: string;
    isCurrent: boolean;
    structureName: string;
    className: string | null;
    items: { feeHeadName: string; amountMinor: number }[];
    totalMinor: number;
  }[] = [];

  if (classId) {
    const termRows = currentTerm
      ? [currentTerm]
      : await db.select().from(terms).where(eq(terms.tenantId, tenantId)).orderBy(desc(terms.startDate)).limit(3);
    for (const term of termRows) {
      const structures = await db.select().from(feeStructures).where(and(
        eq(feeStructures.tenantId, tenantId),
        eq(feeStructures.termId, term.id),
      ));
      const match = structures.find((fs) => !fs.classId || fs.classId === classId)
        ?? structures.find((fs) => !fs.classId);
      if (!match) continue;
      const items = await db.select({
        amount: feeStructureItems.amount,
        feeHeadName: feeHeads.name,
      })
        .from(feeStructureItems)
        .innerJoin(feeHeads, eq(feeHeads.id, feeStructureItems.feeHeadId))
        .where(eq(feeStructureItems.feeStructureId, match.id));
      schoolTermFees.push({
        termId: term.id,
        termName: term.name,
        isCurrent: term.isCurrent === true,
        structureName: match.name,
        className: enrollment?.className ?? null,
        items: items.map((i) => ({ feeHeadName: i.feeHeadName, amountMinor: i.amount })),
        totalMinor: items.reduce((s, i) => s + i.amount, 0),
      });
    }
  }

  const pendingAssignments = classId
    ? await db.select({ n: sql<number>`count(*)` }).from(assignments).where(and(
      eq(assignments.tenantId, tenantId),
      eq(assignments.classId, classId),
    ))
    : [{ n: 0 }];

  const submittedCount = await db.select({ n: sql<number>`count(*)` }).from(assignmentSubmissions)
    .where(and(eq(assignmentSubmissions.tenantId, tenantId), eq(assignmentSubmissions.studentId, studentId)));

  const notices = await db.select().from(announcements).where(and(
    eq(announcements.tenantId, tenantId),
    eq(announcements.published, true),
    inArray(announcements.audience, ["all", "students"]),
  )).orderBy(desc(announcements.createdAt)).limit(15);

  const feeDueMinor = statements.reduce((s, i) => s + Math.max(0, i.totalAmount - i.paidAmount), 0);

  const notifications: {
    id: string;
    type: string;
    title: string;
    body: string;
    createdAt: string;
    linkTab?: string;
  }[] = [];

  if (feeDueMinor > 0) {
    notifications.push({
      id: "fee-due",
      type: "fee",
      title: "Fees outstanding",
      body: `You have unpaid invoice balance.`,
      createdAt: new Date().toISOString(),
      linkTab: "fees",
    });
  }
  for (const a of notices.slice(0, 5)) {
    notifications.push({
      id: `ann-${a.id}`,
      type: "announcement",
      title: a.title,
      body: (a.body ?? "").slice(0, 120),
      createdAt: a.createdAt.toISOString(),
      linkTab: "notices",
    });
  }
  if (overdueLoans.length) {
    notifications.push({
      id: "lib-overdue",
      type: "library",
      title: "Library books overdue",
      body: `${overdueLoans.length} loan(s) past due date.`,
      createdAt: new Date().toISOString(),
      linkTab: "library",
    });
  }

  return {
    currentTerm: currentTerm ?? null,
    currentAcademicYear: currentYear ?? null,
    enrollment: enrollment ?? null,
    statements,
    feeByTerm,
    schoolTermFees,
    reportCards: publishedReportCards,
    cbtExams,
    libraryCard: libraryCard ?? null,
    libraryStats: {
      activeLoans: activeLoans.length,
      overdueLoans: overdueLoans.length,
    },
    libraryLoans: loanRows,
    transport: transport ? { ...transport, stops: routeStops } : null,
    calendar: { upcoming, all: calendarEvents },
    notifications,
    assignmentsTotal: Number(pendingAssignments[0]?.n ?? 0),
    submissionsCount: Number(submittedCount[0]?.n ?? 0),
    feeDueMinor,
  };
}

export async function listStudentTimetableEnriched(tenantId: string, classId: string | null) {
  const conds = [eq(timetablePeriods.tenantId, tenantId)];
  if (classId) conds.push(eq(timetables.classId, classId));

  const periods = await db.select({
    id: timetablePeriods.id,
    dayOfWeek: timetablePeriods.dayOfWeek,
    periodNo: timetablePeriods.periodNo,
    startTime: timetablePeriods.startTime,
    endTime: timetablePeriods.endTime,
    subjectName: subjects.name,
    teacherFirstName: users.firstName,
    teacherLastName: users.lastName,
    className: classes.name,
  })
    .from(timetablePeriods)
    .innerJoin(timetables, eq(timetables.id, timetablePeriods.timetableId))
    .leftJoin(subjects, eq(subjects.id, timetablePeriods.subjectId))
    .leftJoin(users, eq(users.id, timetablePeriods.teacherUserId))
    .leftJoin(classes, eq(classes.id, timetables.classId))
    .where(and(...conds))
    .orderBy(timetablePeriods.dayOfWeek, timetablePeriods.periodNo)
    .limit(80);

  return periods.map((p) => ({
    ...p,
    teacherName: [p.teacherFirstName, p.teacherLastName].filter(Boolean).join(" ") || null,
    dayLabel: DAY_LABELS[p.dayOfWeek] ?? `Day ${p.dayOfWeek}`,
  }));
}
