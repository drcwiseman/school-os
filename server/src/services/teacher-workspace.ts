import { db } from "../db";
import {
  teacherAssignments, timetablePeriods, timetables, assignments, assignmentSubmissions,
  announcements, assessments, marks, classes, subjects, lessonPlans, schemeOfWork,
  teacherMeetings, portalMessages,
} from "../db/schema";
import { eq, and, desc, gte, lte, isNull, sql, inArray } from "drizzle-orm";

export async function getTeacherWorkspace(tenantId: string, userId: string) {
  const day = new Date().getDay();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
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
    .innerJoin(subjects, eq(subjects.id, teacherAssignments.subjectId))
    .where(and(eq(teacherAssignments.tenantId, tenantId), eq(teacherAssignments.userId, userId)));

  const classIds = [...new Set(myAssignments.map((a) => a.classId))];

  const periodsToday = classIds.length
    ? await db
        .select({
          id: timetablePeriods.id,
          dayOfWeek: timetablePeriods.dayOfWeek,
          periodNo: timetablePeriods.periodNo,
          startTime: timetablePeriods.startTime,
          endTime: timetablePeriods.endTime,
          className: classes.name,
          subjectName: subjects.name,
        })
        .from(timetablePeriods)
        .innerJoin(timetables, eq(timetables.id, timetablePeriods.timetableId))
        .innerJoin(classes, eq(classes.id, timetables.classId))
        .leftJoin(subjects, eq(subjects.id, timetablePeriods.subjectId))
        .where(and(
          eq(timetablePeriods.tenantId, tenantId),
          eq(timetablePeriods.dayOfWeek, day),
          eq(timetablePeriods.teacherUserId, userId),
        ))
        .orderBy(timetablePeriods.periodNo)
    : [];

  const upcomingAssignments = classIds.length
    ? await db
        .select()
        .from(assignments)
        .where(and(
          eq(assignments.tenantId, tenantId),
          gte(assignments.dueDate, startOfDay),
          lte(assignments.dueDate, inSevenDays),
          inArray(assignments.classId, classIds),
        ))
        .orderBy(assignments.dueDate)
        .limit(10)
    : [];

  const gradingQueue = classIds.length
    ? await db
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
        .limit(20)
    : [];

  const draftMarks = await db
    .select({
      markId: marks.id,
      assessmentId: assessments.id,
      assessmentName: assessments.name,
      studentId: marks.studentId,
      score: marks.score,
    })
    .from(marks)
    .innerJoin(assessments, eq(assessments.id, marks.assessmentId))
    .where(and(
      eq(marks.tenantId, tenantId),
      eq(marks.status, "draft"),
      eq(marks.enteredBy, userId),
      isNull(marks.deletedAt),
    ))
    .limit(15);

  const recentAnnouncements = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.tenantId, tenantId), eq(announcements.published, true)))
    .orderBy(desc(announcements.createdAt))
    .limit(5);

  const meetings = await db
    .select()
    .from(teacherMeetings)
    .where(and(eq(teacherMeetings.tenantId, tenantId), eq(teacherMeetings.userId, userId), gte(teacherMeetings.scheduledAt, startOfDay)))
    .orderBy(teacherMeetings.scheduledAt)
    .limit(10);

  const unreadMessages = await db
    .select({ count: sql<number>`count(*)` })
    .from(portalMessages)
    .where(and(
      eq(portalMessages.tenantId, tenantId),
      eq(portalMessages.senderType, "parent"),
      isNull(portalMessages.readAt),
    ));

  return {
    myClasses: myAssignments,
    periodsToday,
    upcomingAssignments,
    gradingQueue,
    draftMarks,
    announcements: recentAnnouncements,
    meetings,
    unreadParentMessages: Number(unreadMessages[0]?.count ?? 0),
    overloaded: myAssignments.length > 5,
  };
}
