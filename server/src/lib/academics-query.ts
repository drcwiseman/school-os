import { db } from "../db";
import {
  classes, studentMaterials, students, studentClassHistory, streams,
  onlineClassLinks, onlineClassAttendance,
} from "../db/schema";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { getTableColumns, tableExists } from "./table-columns";

export function onlineClassLinkSelectShape(cols: Set<string>) {
  const shape: Record<string, unknown> = {
    id: onlineClassLinks.id,
    tenantId: onlineClassLinks.tenantId,
    title: onlineClassLinks.title,
    url: onlineClassLinks.url,
    createdAt: onlineClassLinks.createdAt,
  };
  if (cols.has("class_id")) shape.classId = onlineClassLinks.classId;
  if (cols.has("scheduled_at")) shape.scheduledAt = onlineClassLinks.scheduledAt;
  if (cols.has("subject_id")) shape.subjectId = onlineClassLinks.subjectId;
  if (cols.has("duration_minutes")) shape.durationMinutes = onlineClassLinks.durationMinutes;
  if (cols.has("attendance_session_id")) shape.attendanceSessionId = onlineClassLinks.attendanceSessionId;
  return shape;
}

export async function listOnlineClassesForTenant(tenantId: string) {
  if (!(await tableExists("online_class_links"))) return [];
  const cols = await getTableColumns("online_class_links");
  const orderCol = cols.has("scheduled_at") ? onlineClassLinks.scheduledAt : onlineClassLinks.createdAt;
  return db
    .select(onlineClassLinkSelectShape(cols) as any)
    .from(onlineClassLinks)
    .where(eq(onlineClassLinks.tenantId, tenantId))
    .orderBy(desc(orderCol));
}

export async function getOnlineClassById(tenantId: string, id: string) {
  if (!(await tableExists("online_class_links"))) return null;
  const cols = await getTableColumns("online_class_links");
  const [row] = await db
    .select(onlineClassLinkSelectShape(cols) as any)
    .from(onlineClassLinks)
    .where(and(eq(onlineClassLinks.id, id), eq(onlineClassLinks.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function insertOnlineClass(
  tenantId: string,
  data: {
    title: string;
    url: string;
    classId?: string | null;
    subjectId?: string | null;
    scheduledAt?: Date | null;
    durationMinutes?: number;
  },
) {
  if (!(await tableExists("online_class_links"))) {
    throw new Error("online_class_links table is missing — run npm run db:repair --prefix server");
  }
  const cols = await getTableColumns("online_class_links");
  const values: Record<string, unknown> = {
    tenantId,
    title: data.title,
    url: data.url,
  };
  if (cols.has("class_id")) values.classId = data.classId ?? null;
  if (cols.has("subject_id")) values.subjectId = data.subjectId ?? null;
  if (cols.has("scheduled_at")) values.scheduledAt = data.scheduledAt ?? null;
  if (cols.has("duration_minutes")) values.durationMinutes = data.durationMinutes ?? 60;
  const [inserted] = await db.insert(onlineClassLinks).values(values as any).returning({ id: onlineClassLinks.id });
  const row = await getOnlineClassById(tenantId, inserted.id);
  return row ?? { id: inserted.id, tenantId, ...values };
}

export async function setOnlineClassAttendanceSessionId(linkId: string, sessionId: string) {
  const cols = await getTableColumns("online_class_links");
  if (!cols.has("attendance_session_id")) return;
  await db.update(onlineClassLinks).set({ attendanceSessionId: sessionId }).where(eq(onlineClassLinks.id, linkId));
}

export async function listOnlineClassAttendance(onlineClassId: string, tenantId: string) {
  if (!(await tableExists("online_class_attendance"))) return [];
  const cols = await getTableColumns("online_class_attendance");
  const shape: Record<string, unknown> = {
    id: onlineClassAttendance.id,
    studentId: onlineClassAttendance.studentId,
    status: onlineClassAttendance.status,
    firstName: students.firstName,
    lastName: students.lastName,
    admissionNumber: students.admissionNumber,
  };
  if (cols.has("joined_at")) shape.joinedAt = onlineClassAttendance.joinedAt;
  if (cols.has("performance_score")) shape.performanceScore = onlineClassAttendance.performanceScore;
  if (cols.has("notes")) shape.notes = onlineClassAttendance.notes;
  if (cols.has("duration_minutes")) shape.durationMinutes = onlineClassAttendance.durationMinutes;
  if (cols.has("marked_by")) shape.markedBy = onlineClassAttendance.markedBy;

  return db
    .select(shape as any)
    .from(onlineClassAttendance)
    .innerJoin(students, eq(students.id, onlineClassAttendance.studentId))
    .where(and(
      eq(onlineClassAttendance.onlineClassId, onlineClassId),
      eq(onlineClassAttendance.tenantId, tenantId),
    ));
}

export async function listClassesForTenant(tenantId: string, campusId?: string) {
  const cols = await getTableColumns("classes");
  const shape: Record<string, unknown> = {
    id: classes.id,
    tenantId: classes.tenantId,
    name: classes.name,
    level: classes.level,
    createdAt: classes.createdAt,
  };
  if (cols.has("campus_id")) shape.campusId = classes.campusId;
  const conditions = [eq(classes.tenantId, tenantId)];
  if (campusId && cols.has("campus_id")) conditions.push(eq(classes.campusId, campusId));
  return db.select(shape as any).from(classes).where(and(...conditions)).orderBy(classes.level);
}

export async function listStudentMaterialsForTenant(tenantId: string) {
  if (!(await tableExists("student_materials"))) return [];
  const cols = await getTableColumns("student_materials");
  const shape: Record<string, unknown> = {
    id: studentMaterials.id,
    tenantId: studentMaterials.tenantId,
    title: studentMaterials.title,
    createdAt: studentMaterials.createdAt,
  };
  if (cols.has("subject")) shape.subject = studentMaterials.subject;
  if (cols.has("subject_id")) shape.subjectId = studentMaterials.subjectId;
  if (cols.has("url")) shape.url = studentMaterials.url;
  if (cols.has("class_id")) shape.classId = studentMaterials.classId;
  if (cols.has("file_path")) shape.filePath = studentMaterials.filePath;
  if (cols.has("file_name")) shape.fileName = studentMaterials.fileName;
  if (cols.has("mime_type")) shape.mimeType = studentMaterials.mimeType;
  if (cols.has("folder")) shape.folder = studentMaterials.folder;
  return db
    .select(shape as any)
    .from(studentMaterials)
    .where(eq(studentMaterials.tenantId, tenantId))
    .orderBy(studentMaterials.createdAt);
}

export async function rosterForStream(tenantId: string, streamId: string) {
  const [stream] = await db
    .select()
    .from(streams)
    .where(and(eq(streams.id, streamId), eq(streams.tenantId, tenantId)))
    .limit(1);
  if (!stream) return null;

  const studentCols = await getTableColumns("students");
  const conditions = [
    eq(studentClassHistory.tenantId, tenantId),
    eq(studentClassHistory.classId, stream.classId),
    isNull(studentClassHistory.toDate),
    or(
      eq(studentClassHistory.streamId, stream.id),
      isNull(studentClassHistory.streamId),
    )!,
  ];
  if (studentCols.has("deleted_at")) conditions.push(isNull(students.deletedAt));

  const roster = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNumber: students.admissionNumber,
      streamId: studentClassHistory.streamId,
    })
    .from(studentClassHistory)
    .innerJoin(students, eq(students.id, studentClassHistory.studentId))
    .where(and(...conditions));

  return { stream, roster };
}
