import { db } from "../db";
import {
  teacherAssignments, timetablePeriods, timetables, assignments, assignmentSubmissions,
  announcements, assessments, marks, classes, subjects, lessonPlans, schemeOfWork,
  teacherMeetings, portalMessages,
} from "../db/schema";
import { eq, and, desc, gte, lte, isNull, sql, inArray } from "drizzle-orm";
import { getTableColumns, tableExists } from "../lib/table-columns";

const EMPTY = {
  myClasses: [] as unknown[],
  periodsToday: [] as unknown[],
  upcomingAssignments: [] as unknown[],
  gradingQueue: [] as unknown[],
  draftMarks: [] as unknown[],
  announcements: [] as unknown[],
  meetings: [] as unknown[],
  unreadParentMessages: 0,
  overloaded: false,
};

export async function getTeacherWorkspace(tenantId: string, userId: string) {
  if (!(await tableExists("teacher_assignments"))) return { ...EMPTY };

  const day = new Date().getDay();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const inSevenDays = new Date();
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  const myAssignments = await db
    .select({
      id: teacherAssignments.id,
      classId: teacherAssignments.classId,
      subjectId: teacherAssignments.subjectId,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(teacherAssignments)
    .innerJoin(classes, eq(classes.id, teacherAssignments.classId))
    .leftJoin(subjects, eq(subjects.id, teacherAssignments.subjectId))
    .where(and(eq(teacherAssignments.tenantId, tenantId), eq(teacherAssignments.userId, userId)));

  const classIds = [...new Set(myAssignments.map((a) => a.classId))];

  let periodsToday: typeof EMPTY.periodsToday = [];
  if (classIds.length && (await tableExists("timetable_periods")) && (await tableExists("timetables"))) {
    const tpCols = await getTableColumns("timetable_periods");
    try {
      const shape: Record<string, unknown> = {
        id: timetablePeriods.id,
        dayOfWeek: timetablePeriods.dayOfWeek,
        periodNo: timetablePeriods.periodNo,
        className: classes.name,
        subjectName: subjects.name,
      };
      if (tpCols.has("start_time")) shape.startTime = timetablePeriods.startTime;
      if (tpCols.has("end_time")) shape.endTime = timetablePeriods.endTime;
      const conds = [
        eq(timetablePeriods.tenantId, tenantId),
        eq(timetablePeriods.dayOfWeek, day),
      ];
      if (tpCols.has("teacher_user_id")) conds.push(eq(timetablePeriods.teacherUserId, userId));
      periodsToday = await db
        .select(shape as any)
        .from(timetablePeriods)
        .innerJoin(timetables, eq(timetables.id, timetablePeriods.timetableId))
        .innerJoin(classes, eq(classes.id, timetables.classId))
        .leftJoin(subjects, eq(subjects.id, timetablePeriods.subjectId))
        .where(and(...conds))
        .orderBy(timetablePeriods.periodNo);
    } catch {
      periodsToday = [];
    }
  }

  let upcomingAssignments: typeof EMPTY.upcomingAssignments = [];
  if (classIds.length && (await tableExists("assignments"))) {
    try {
      upcomingAssignments = await db
        .select()
        .from(assignments)
        .where(and(
          eq(assignments.tenantId, tenantId),
          gte(assignments.dueDate, startOfDay),
          lte(assignments.dueDate, inSevenDays),
          inArray(assignments.classId, classIds),
        ))
        .orderBy(assignments.dueDate)
        .limit(10);
    } catch {
      upcomingAssignments = [];
    }
  }

  let gradingQueue: typeof EMPTY.gradingQueue = [];
  if (classIds.length && (await tableExists("assignment_submissions"))) {
    try {
      gradingQueue = await db
        .select({
          submissionId: assignmentSubmissions.id,
          assignmentId: assignments.id,
          assignmentTitle: assignments.title,
          studentId: assignmentSubmissions.studentId,
          submittedAt: assignmentSubmissions.submittedAt,
          content: assignmentSubmissions.content,
        })
        .from(assignmentSubmissions)
        .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
        .where(and(eq(assignmentSubmissions.tenantId, tenantId), inArray(assignments.classId, classIds)))
        .orderBy(desc(assignmentSubmissions.submittedAt))
        .limit(20);
    } catch {
      gradingQueue = [];
    }
  }

  let draftMarks: typeof EMPTY.draftMarks = [];
  if (await tableExists("marks") && (await tableExists("assessments"))) {
    try {
      const markCols = await getTableColumns("marks");
      const conds = [
        eq(marks.tenantId, tenantId),
        eq(marks.enteredBy, userId),
      ];
      if (markCols.has("status")) conds.push(eq(marks.status, "draft"));
      if (markCols.has("deleted_at")) conds.push(isNull(marks.deletedAt));
      draftMarks = await db
        .select({
          markId: marks.id,
          assessmentId: assessments.id,
          assessmentName: assessments.name,
          studentId: marks.studentId,
          score: marks.score,
        })
        .from(marks)
        .innerJoin(assessments, eq(assessments.id, marks.assessmentId))
        .where(and(...conds))
        .limit(15);
    } catch {
      draftMarks = [];
    }
  }

  let recentAnnouncements: typeof EMPTY.announcements = [];
  if (await tableExists("announcements")) {
    try {
      const annCols = await getTableColumns("announcements");
      const conds = [eq(announcements.tenantId, tenantId)];
      if (annCols.has("published")) conds.push(eq(announcements.published, true));
      recentAnnouncements = await db
        .select()
        .from(announcements)
        .where(and(...conds))
        .orderBy(desc(announcements.createdAt))
        .limit(5);
    } catch {
      recentAnnouncements = [];
    }
  }

  let meetings: typeof EMPTY.meetings = [];
  if (await tableExists("teacher_meetings")) {
    try {
      meetings = await db
        .select()
        .from(teacherMeetings)
        .where(and(
          eq(teacherMeetings.tenantId, tenantId),
          eq(teacherMeetings.userId, userId),
          gte(teacherMeetings.scheduledAt, startOfDay),
        ))
        .orderBy(teacherMeetings.scheduledAt)
        .limit(10);
    } catch {
      meetings = [];
    }
  }

  let unreadParentMessages = 0;
  if (await tableExists("portal_messages")) {
    try {
      const unreadMessages = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(portalMessages)
        .where(and(
          eq(portalMessages.tenantId, tenantId),
          eq(portalMessages.senderType, "parent"),
          isNull(portalMessages.readAt),
        ));
      unreadParentMessages = Number(unreadMessages[0]?.count ?? 0);
    } catch {
      unreadParentMessages = 0;
    }
  }

  return {
    myClasses: myAssignments,
    periodsToday,
    upcomingAssignments,
    gradingQueue,
    draftMarks,
    announcements: recentAnnouncements,
    meetings,
    unreadParentMessages,
    overloaded: myAssignments.length > 5,
  };
}
