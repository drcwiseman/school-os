import { db } from "../db";
import { classes, studentMaterials, students, studentClassHistory, streams } from "../db/schema";
import { and, eq, isNull, or } from "drizzle-orm";
import { getTableColumns, tableExists } from "./table-columns";

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
