import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  students,
  studentClassHistory,
  teacherAssignments,
  users,
  userRoles,
  roles,
} from "../db/schema";
import { ForbiddenError, NotFoundError } from "../middleware/error";
import { getUserPermissions } from "../middleware/rbac";

async function currentEnrollment(tenantId: string, studentId: string) {
  const [row] = await db.select({
    classId: studentClassHistory.classId,
    streamId: studentClassHistory.streamId,
  }).from(studentClassHistory).where(and(
    eq(studentClassHistory.studentId, studentId),
    eq(studentClassHistory.tenantId, tenantId),
    isNull(studentClassHistory.toDate),
  )).limit(1);
  return row ?? null;
}

export async function getStudentMessageRecipients(tenantId: string, studentId: string) {
  const enrollment = await currentEnrollment(tenantId, studentId);
  if (!enrollment?.classId) return { teachers: [], admins: [] };

  const teacherRows = await db.select({
    userId: teacherAssignments.userId,
    firstName: users.firstName,
    lastName: users.lastName,
    role: teacherAssignments.role,
  })
    .from(teacherAssignments)
    .innerJoin(users, eq(users.id, teacherAssignments.userId))
    .where(and(
      eq(teacherAssignments.tenantId, tenantId),
      eq(teacherAssignments.classId, enrollment.classId),
    ));

  const seen = new Set<string>();
  const teachers = teacherRows.filter((t) => {
    if (seen.has(t.userId)) return false;
    seen.add(t.userId);
    return true;
  }).map((t) => ({
    userId: t.userId,
    name: `${t.firstName} ${t.lastName}`.trim(),
    role: t.role,
    kind: "teacher" as const,
  }));

  const adminRows = await db.select({
    userId: users.id,
    firstName: users.firstName,
    lastName: users.lastName,
    roleName: roles.name,
  })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(
      eq(users.tenantId, tenantId),
      inArray(roles.name, ["admin", "principal", "headteacher", "school_admin"]),
    ))
    .limit(20);

  const admins = adminRows.map((a) => ({
    userId: a.userId,
    name: `${a.firstName} ${a.lastName}`.trim(),
    role: a.roleName,
    kind: "administration" as const,
  }));

  return { teachers, admins };
}

export async function assertStaffCanMessageStudent(
  tenantId: string,
  staffUserId: string,
  studentId: string,
) {
  const permissions = await getUserPermissions(staffUserId, tenantId);
  if (permissions.includes("students.manage") || permissions.includes("settings.manage")) {
    return;
  }

  const enrollment = await currentEnrollment(tenantId, studentId);
  if (!enrollment?.classId) throw new ForbiddenError("Student has no active class enrollment");

  const [assignment] = await db.select().from(teacherAssignments).where(and(
    eq(teacherAssignments.tenantId, tenantId),
    eq(teacherAssignments.userId, staffUserId),
    eq(teacherAssignments.classId, enrollment.classId),
  )).limit(1);

  if (!assignment) {
    throw new ForbiddenError("You can only message students in your assigned classes");
  }
}

export async function assertStudentCanMessageRecipient(
  tenantId: string,
  studentId: string,
  recipientUserId: string,
) {
  const { teachers, admins } = await getStudentMessageRecipients(tenantId, studentId);
  const allowed = [...teachers, ...admins].some((r) => r.userId === recipientUserId);
  if (!allowed) throw new ForbiddenError("You can only message your class teachers or school administration");
}

export async function getTeacherMessageRecipients(tenantId: string, staffUserId: string) {
  const permissions = await getUserPermissions(staffUserId, tenantId);
  const isAdmin = permissions.includes("students.manage") || permissions.includes("settings.manage");

  if (isAdmin) {
    const rows = await db.select({
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNumber: students.admissionNumber,
    })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), isNull(students.deletedAt)))
      .limit(500);
    return rows.map((r) => ({
      studentId: r.studentId,
      name: `${r.firstName} ${r.lastName}`.trim(),
      admissionNumber: r.admissionNumber,
    }));
  }

  const myClasses = await db.select({ classId: teacherAssignments.classId })
    .from(teacherAssignments)
    .where(and(
      eq(teacherAssignments.tenantId, tenantId),
      eq(teacherAssignments.userId, staffUserId),
    ));
  const classIds = [...new Set(myClasses.map((c) => c.classId))];
  if (!classIds.length) return [];

  const rows = await db.select({
    studentId: students.id,
    firstName: students.firstName,
    lastName: students.lastName,
    admissionNumber: students.admissionNumber,
  })
    .from(students)
    .innerJoin(studentClassHistory, and(
      eq(studentClassHistory.studentId, students.id),
      eq(studentClassHistory.tenantId, tenantId),
      isNull(studentClassHistory.toDate),
      inArray(studentClassHistory.classId, classIds),
    ))
    .where(and(eq(students.tenantId, tenantId), isNull(students.deletedAt)));

  return rows.map((r) => ({
    studentId: r.studentId,
    name: `${r.firstName} ${r.lastName}`.trim(),
    admissionNumber: r.admissionNumber,
  }));
}

export async function assertParentCanMessageRecipient(
  tenantId: string,
  _guardianId: string,
  studentId: string,
  recipientUserId: string | undefined,
) {
  const { teachers, admins } = await getStudentMessageRecipients(tenantId, studentId);
  if (!recipientUserId) {
    if (!teachers.length && !admins.length) throw new NotFoundError("No message recipients available");
    return;
  }
  const allowed = [...teachers, ...admins].some((r) => r.userId === recipientUserId);
  if (!allowed) throw new ForbiddenError("Invalid message recipient for this child");
}
